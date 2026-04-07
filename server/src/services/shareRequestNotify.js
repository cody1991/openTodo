const db = require('../db');
const { sendMarkdown } = require('./wecom');

const PRIORITY_LABEL = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/** Strip / escape characters that break WeCom markdown when echoing user text */
function safeLine(s, maxLen) {
  if (s == null) return '';
  let t = String(s).replace(/\r\n/g, '\n').trim();
  if (maxLen && t.length > maxLen) t = `${t.slice(0, maxLen)}…`;
  return t.replace(/\n/g, ' ');
}

/**
 * Fire-and-forget: notify link owner via WeCom robot when a visitor submits a share request.
 * Requires user.notifications_enabled and a valid wecom_webhook (same as日报/提醒).
 */
function notifyNewShareRequestAsync({ ownerId, shareLinkName, title, priority, content, contact }) {
  setImmediate(() => {
    try {
      // Always write an in-app notification
      const notifTitle = `新分享需求：${String(title || '').slice(0, 60)}`;
      const notifContent = [
        `来源：${shareLinkName || '分享'}`,
        contact ? `联系方式：${String(contact).slice(0, 100)}` : null,
        content ? `摘要：${String(content).slice(0, 120)}` : null,
      ].filter(Boolean).join(' · ');
      db.prepare(
        `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'share_request', ?, ?)`
      ).run(ownerId, notifTitle, notifContent);
    } catch (e) {
      console.error('[shareRequestNotify] in-app insert failed:', e.message);
    }

    try {
      const row = db
        .prepare('SELECT wecom_webhook, notifications_enabled FROM users WHERE id = ?')
        .get(ownerId);
      if (!row?.notifications_enabled || !row.wecom_webhook) return;

      const lines = [];
      lines.push('## 新分享需求');
      lines.push('');
      lines.push(`**标题：** ${safeLine(title, 200)}`);
      lines.push(`**优先级：** ${PRIORITY_LABEL[priority] || priority}`);
      lines.push(`**来源分享：** ${safeLine(shareLinkName || '分享', 120)}`);
      if (contact) lines.push(`**联系方式：** ${safeLine(contact, 200)}`);
      const snippet = safeLine(content, 500);
      if (snippet) {
        lines.push('');
        lines.push('**正文摘要：**');
        lines.push(snippet);
      }

      const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
      lines.push('');
      if (base) {
        const inboxUrl = `${base}/share-requests`;
        lines.push(`[打开需求收件箱](${inboxUrl})`);
      } else {
        lines.push('请登录 OpenTodo → **需求收件箱** 审核。');
      }

      sendMarkdown(row.wecom_webhook, lines.join('\n'));
    } catch (e) {
      console.error('[shareRequestNotify] wecom failed:', e.message);
    }
  });
}

module.exports = { notifyNewShareRequestAsync };
