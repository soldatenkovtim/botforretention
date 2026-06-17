import cron from 'node-cron';
import { processDueTriggers, processWebinarReminders } from '../triggers/triggerService';

export function startScheduler(): void {
  // Every minute: check for due triggers
  cron.schedule('* * * * *', async () => {
    try {
      await processDueTriggers();
    } catch (error) {
      console.error('Error processing due triggers:', error);
    }
  });

  // Every minute: check for webinar reminders (24h before)
  cron.schedule('* * * * *', async () => {
    try {
      await processWebinarReminders();
    } catch (error) {
      console.error('Error processing webinar reminders:', error);
    }
  });

  console.log('✅ Scheduler started');
}
