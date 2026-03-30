const db = require('../db');
const { sendMarkdown } = require('./wecom');

const PRIORITY_EMOJI = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

function generateDailyReport(userId) {
  const today = new Date().toISOString().split('T')[0];

  const completedYesterday = db
    .prepare(
      `SELECT t.title, c.name as category_name, t.priority
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status = 'completed'
         AND DATE(t.completed_at) = DATE('now', '-1 day')`
    )
    .all(userId);

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
      const due = t.due_date ? ` _(截止 ${t.due_date.split('T')[0]})_` : '';
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
      `SELECT id, username, wecom_webhook
       FROM users
       WHERE notifications_enabled = 1 AND daily_report_enabled = 1 AND wecom_webhook IS NOT NULL`
    )
    .all();

  console.log(`[Report] Sending daily reports to ${users.length} user(s)`);

  for (const user of users) {
    const content = generateDailyReport(user.id);
    await sendMarkdown(user.wecom_webhook, content);
    console.log(`[Report] Sent to user: ${user.username}`);
  }
}

async function sendDueDateReminders() {
  const todos = db
    .prepare(
      `SELECT t.*, u.wecom_webhook, u.username
       FROM todos t
       JOIN users u ON t.user_id = u.id
       WHERE t.status != 'completed'
         AND t.due_date IS NOT NULL
         AND t.due_date BETWEEN CURRENT_TIMESTAMP AND DATETIME('now', '+24 hours')
         AND t.notify_enabled = 1
         AND u.notifications_enabled = 1
         AND u.wecom_webhook IS NOT NULL`
    )
    .all();

  const grouped = {};
  todos.forEach((t) => {
    if (!grouped[t.user_id]) grouped[t.user_id] = { webhook: t.wecom_webhook, items: [] };
    grouped[t.user_id].items.push(t);
  });

  for (const [, data] of Object.entries(grouped)) {
    const content =
      `## ⏰ 即将到期提醒\n\n` +
      data.items
        .map((t) => {
          const due = new Date(t.due_date).toLocaleString('zh-CN');
          return `> ${PRIORITY_EMOJI[t.priority] || '•'} **${t.title}** · 截止 ${due}`;
        })
        .join('\n') +
      '\n\n_请及时处理以上事项_';

    await sendMarkdown(data.webhook, content);
  }

  console.log(`[Reminder] Sent due-date reminders for ${todos.length} todo(s)`);
}

function updateOverdueStatus() {
  const result = db
    .prepare(
      `UPDATE todos SET is_overdue = 1
       WHERE status != 'completed'
         AND due_date IS NOT NULL
         AND due_date < CURRENT_TIMESTAMP
         AND is_overdue = 0`
    )
    .run();

  db.prepare(
    `UPDATE todos SET is_overdue = 0
     WHERE (status = 'completed' OR due_date IS NULL OR due_date >= CURRENT_TIMESTAMP)
       AND is_overdue = 1`
  ).run();

  if (result.changes > 0) {
    console.log(`[Overdue] Marked ${result.changes} todo(s) as overdue`);
  }
}

module.exports = { sendDailyReports, sendDueDateReminders, updateOverdueStatus, generateDailyReport };
