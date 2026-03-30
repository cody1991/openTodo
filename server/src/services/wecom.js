const axios = require('axios');

async function sendMarkdown(webhookUrl, content) {
  if (!webhookUrl) return;
  try {
    const res = await axios.post(webhookUrl, {
      msgtype: 'markdown',
      markdown: { content },
    });
    if (res.data.errcode !== 0) {
      console.error('[WeCom] Send failed:', res.data.errmsg);
    }
  } catch (err) {
    console.error('[WeCom] Request error:', err.message);
  }
}

async function sendText(webhookUrl, text) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, {
      msgtype: 'text',
      text: { content: text },
    });
  } catch (err) {
    console.error('[WeCom] Send text error:', err.message);
  }
}

module.exports = { sendMarkdown, sendText };
