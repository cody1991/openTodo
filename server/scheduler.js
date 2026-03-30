require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cron = require('node-cron');
const { sendDailyReports, sendDueDateReminders, updateOverdueStatus } = require('./src/services/report');

console.log('[Scheduler] Starting TODO scheduler...');

// Send daily report at 09:00 every day
cron.schedule('0 9 * * *', async () => {
  console.log('[Scheduler] Running daily report...');
  await sendDailyReports();
}, { timezone: 'UTC' });

// Check due date reminders every hour
cron.schedule('0 * * * *', async () => {
  console.log('[Scheduler] Running due date reminders...');
  await sendDueDateReminders();
}, { timezone: 'UTC' });

// Update overdue status every 30 minutes
cron.schedule('*/30 * * * *', () => {
  updateOverdueStatus();
}, { timezone: 'UTC' });

console.log('[Scheduler] All cron jobs registered');
