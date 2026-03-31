const axios = require('axios');

async function sendMarkdown(webhookUrl, content) {
  if (!webhookUrl) return;
  const preview = content.replace(/\n/g, ' ').slice(0, 60);
  console.log(`[WeCom] Sending markdown: "${preview}..."`);
  try {
    const res = await axios.post(webhookUrl, {
      msgtype: 'markdown',
      markdown: { content },
    });
    if (res.data.errcode !== 0) {
      console.error('[WeCom] Send failed:', res.data.errmsg);
    } else {
      console.log('[WeCom] Markdown sent successfully.');
    }
  } catch (err) {
    console.error('[WeCom] Request error:', err.message);
  }
}

async function sendText(webhookUrl, text) {
  if (!webhookUrl) return;
  const preview = text.slice(0, 60);
  console.log(`[WeCom] Sending text: "${preview}${text.length > 60 ? '...' : ''}"`);
  try {
    const res = await axios.post(webhookUrl, {
      msgtype: 'text',
      text: { content: text },
    });
    if (res.data?.errcode !== 0) {
      console.error('[WeCom] Send text failed:', res.data?.errmsg);
    } else {
      console.log('[WeCom] Text sent successfully.');
    }
  } catch (err) {
    console.error('[WeCom] Send text error:', err.message);
  }
}

module.exports = { sendMarkdown, sendText };
