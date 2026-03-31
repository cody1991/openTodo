const axios = require('axios');

function getAllowedWecomHosts() {
  const envVal = process.env.WECOM_ALLOWED_HOSTS;
  if (envVal) {
    return envVal.split(',').map((h) => h.trim()).filter(Boolean);
  }
  return ['qyapi.weixin.qq.com'];
}

function validateWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!getAllowedWecomHosts().includes(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function sendMarkdown(webhookUrl, content) {
  if (!webhookUrl) return;
  if (!validateWebhookUrl(webhookUrl)) {
    console.error('[WeCom] Blocked invalid webhook URL:', webhookUrl);
    return;
  }
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
  if (!validateWebhookUrl(webhookUrl)) {
    console.error('[WeCom] Blocked invalid webhook URL:', webhookUrl);
    return;
  }
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
