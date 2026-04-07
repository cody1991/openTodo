const db = require('../db');
const { sendMarkdown } = require('./wecom');
const { getLocalDate, getLocalHHMM, getLocalDayUTCBounds, formatDueDate, utcToLocalDate } = require('../utils/dateUtils');

const PRIORITY_EMOJI = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

function generateDailyReport(userId, timezone) {
  const tz = timezone || 'UTC';
  const today = getLocalDate(tz);
  const yesterday = getLocalDate(tz, -1);

  const [yesterdayStart, yesterdayEnd] = getLocalDayUTCBounds(yesterday, tz);
  const completedYesterday = db
    .prepare(
      `SELECT t.title, c.name as category_name, t.priority
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status = 'completed'
         AND t.completed_at >= ? AND t.completed_at < ?`
    )
    .all(userId, yesterdayStart, yesterdayEnd);

  const pendingToday = db
    .prepare(
      `SELECT t.title, c.name as category_name, t.priority, t.due_date
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed' AND t.notify_enabled = 1
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST
       LIMIT 15`
    )
    .all(userId);

  const overdue = db
    .prepare(
      `SELECT COUNT(*) as count FROM todos
       WHERE user_id = ? AND status != 'completed'
         AND due_date < CURRENT_TIMESTAMP AND due_date IS NOT NULL`
    )
    .get(userId);

  let content = `## 📋 TODO 日报 · ${today}\n\n`;

  if (completedYesterday.length > 0) {
    content += `**✅ 昨日完成 (${completedYesterday.length} 项)**\n`;
    completedYesterday.forEach((t) => {
      const cat = t.category_name ? `[${t.category_name}]` : '';
      content += `> ${PRIORITY_EMOJI[t.priority] || '•'} ${cat} ${t.title}\n`;
    });
    content += '\n';
  } else {
    content += `**✅ 昨日完成：暂无**\n\n`;
  }

  if (pendingToday.length > 0) {
    content += `**📌 待办事项 (${pendingToday.length} 项)**\n`;
    pendingToday.forEach((t) => {
      const cat = t.category_name ? `[${t.category_name}]` : '';
      const due = t.due_date ? ` _(截止 ${utcToLocalDate(t.due_date, tz)})_` : '';
      content += `> ${PRIORITY_EMOJI[t.priority] || '•'} ${cat} ${t.title}${due}\n`;
    });
    content += '\n';
  }

  if (overdue.count > 0) {
    content += `> ⚠️ **逾期未完成：${overdue.count} 项，请尽快处理！**\n`;
  }

  return content;
}

async function sendDailyReports() {
  const users = db
    .prepare(
      `SELECT id, username, wecom_webhook, timezone, daily_report_time
       FROM users
       WHERE notifications_enabled = 1 AND daily_report_enabled = 1 AND wecom_webhook IS NOT NULL`
    )
    .all();

  console.log(`[Report] Checking daily reports for ${users.length} user(s)`);

  for (const user of users) {
    const tz = user.timezone || 'UTC';
    const localHHMM = getLocalHHMM(tz);
    const reportTime = user.daily_report_time || '09:00';

    if (localHHMM !== reportTime) continue;

    const content = generateDailyReport(user.id, tz);
    await sendMarkdown(user.wecom_webhook, content);
    console.log(`[Report] Sent to user: ${user.username} (${tz} ${localHHMM})`);
  }
}

async function sendDueDateReminders() {
  const todos = db
    .prepare(
      `SELECT t.*, u.wecom_webhook, u.username, u.timezone, u.notifications_enabled
       FROM todos t
       JOIN users u ON t.user_id = u.id
       WHERE t.status != 'completed'
         AND t.due_date IS NOT NULL
         AND t.due_date BETWEEN CURRENT_TIMESTAMP AND DATETIME('now', '+24 hours')
         AND t.notify_enabled = 1`
    )
    .all();

  const grouped = {};
  todos.forEach((t) => {
    if (!grouped[t.user_id]) grouped[t.user_id] = {
      webhook: t.wecom_webhook,
      timezone: t.timezone,
      notificationsEnabled: t.notifications_enabled,
      items: [],
    };
    grouped[t.user_id].items.push(t);
  });

  const alreadyNotified = db.prepare(
    `SELECT 1 FROM notifications
     WHERE user_id = ? AND type = 'due_reminder' AND title = ?
       AND created_at >= DATE('now')`
  );
  const insertNotif = db.prepare(
    `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'due_reminder', ?, ?)`
  );

  for (const [userId, data] of Object.entries(grouped)) {
    const tz = data.timezone || 'UTC';

    // In-app notifications (always, no webhook required)
    if (data.notificationsEnabled) {
      for (const t of data.items) {
        const due = formatDueDate(t.due_date, tz);
        const notifTitle = `截止提醒：${t.title}`;
        if (!alreadyNotified.get(parseInt(userId), notifTitle)) {
          insertNotif.run(parseInt(userId), notifTitle, `截止时间：${due}`);
        }
      }
    }

    // WeCom webhook (only if configured)
    if (data.webhook) {
      const content =
        `## ⏰ 即将到期提醒\n\n` +
        data.items
          .map((t) => {
            const due = formatDueDate(t.due_date, tz);
            return `> ${PRIORITY_EMOJI[t.priority] || '•'} **${t.title}** · 截止 ${due}`;
          })
          .join('\n') +
        '\n\n_请及时处理以上事项_';
      await sendMarkdown(data.webhook, content);
    }
  }

  console.log(`[Reminder] Processed due-date reminders for ${todos.length} todo(s)`);
}

function updateOverdueStatus() {
  // Find todos that are newly overdue (is_overdue = 0 → 1)
  const newlyOverdue = db
    .prepare(
      `SELECT t.id, t.user_id, t.title, u.notifications_enabled
       FROM todos t
       JOIN users u ON t.user_id = u.id
       WHERE t.status != 'completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < CURRENT_TIMESTAMP
         AND t.is_overdue = 0`
    )
    .all();

  if (newlyOverdue.length > 0) {
    db.prepare(
      `UPDATE todos SET is_overdue = 1
       WHERE status != 'completed'
         AND due_date IS NOT NULL
         AND due_date < CURRENT_TIMESTAMP
         AND is_overdue = 0`
    ).run();

    // Write in-app notifications for newly overdue todos
    const insertNotif = db.prepare(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'overdue', ?, ?)`
    );
    for (const t of newlyOverdue) {
      if (t.notifications_enabled) {
        insertNotif.run(t.user_id, `已逾期：${t.title}`, '该任务已超过截止时间，请尽快处理。');
      }
    }

    console.log(`[Overdue] Marked ${newlyOverdue.length} todo(s) as overdue`);
  }

  // Clear overdue flag for completed / no-due-date / future todos
  db.prepare(
    `UPDATE todos SET is_overdue = 0
     WHERE (status = 'completed' OR due_date IS NULL OR due_date >= CURRENT_TIMESTAMP)
       AND is_overdue = 1`
  ).run();
}

module.exports = { sendDailyReports, sendDueDateReminders, updateOverdueStatus, generateDailyReport };
