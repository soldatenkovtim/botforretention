import { getDueTriggers, markTriggerFired } from '../db/models/trigger';
import { getNotificationRecipients, getAllActiveUsers } from '../db/models/user';
import { hasMessageBeenSent } from '../db/models/sentMessage';
import { getWebinarsNeedingReminder } from '../db/models/webinar';
import { enqueueMessage, SendMessageJob } from '../queue/messageQueue';
import {
  getPreLaunch3dMessage,
  getPreLaunch1dMessage,
  getPreLaunchStartMessage,
  getWeeklyLeaderboardMessage,
  getWebinarReminderMessage,
  getMidChampMessage,
  getChampClosedMessage,
  MessageTemplate,
} from './templates';

function getTemplateForTrigger(triggerKey: string): MessageTemplate | null {
  switch (triggerKey) {
    case 'pre_launch_3d':
      return getPreLaunch3dMessage();
    case 'pre_launch_1d':
      return getPreLaunch1dMessage();
    case 'pre_launch_start':
      return getPreLaunchStartMessage();
    case 'weekly_leaderboard_update':
      return getWeeklyLeaderboardMessage();
    case 'mid_champ_early_selection':
      return getMidChampMessage();
    case 'champ_closed_results':
      return getChampClosedMessage();
    default:
      return null;
  }
}

export async function processDueTriggers(): Promise<void> {
  const now = new Date();
  const dueTriggers = await getDueTriggers(now);

  for (const trigger of dueTriggers) {
    console.log(`Processing trigger: ${trigger.trigger_key} for championship ${trigger.championship_id}`);

    const template = getTemplateForTrigger(trigger.trigger_key);
    if (!template) {
      console.warn(`No template found for trigger: ${trigger.trigger_key}`);
      await markTriggerFired(trigger.id);
      continue;
    }

    const users = await getNotificationRecipients();

    for (const user of users) {
      const alreadySent = await hasMessageBeenSent(
        user.telegram_id,
        trigger.trigger_key,
        trigger.championship_id
      );

      if (alreadySent) continue;

      const job: SendMessageJob = {
        telegramId: user.telegram_id,
        text: template.text,
        keyboard: template.keyboard,
        triggerKey: trigger.trigger_key,
        championshipId: trigger.championship_id,
      };

      await enqueueMessage(job);
    }

    await markTriggerFired(trigger.id);
  }
}

export async function processWebinarReminders(): Promise<void> {
  const now = new Date();
  const reminderTarget = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const webinars = await getWebinarsNeedingReminder(reminderTarget);

  for (const webinar of webinars) {
    const template = getWebinarReminderMessage(webinar);
    const users = await getNotificationRecipients();

    for (const user of users) {
      const alreadySent = await hasMessageBeenSent(
        user.telegram_id,
        'webinar_reminder_24h',
        webinar.championship_id,
        webinar.id
      );

      if (alreadySent) continue;

      const job: SendMessageJob = {
        telegramId: user.telegram_id,
        text: template.text,
        keyboard: template.keyboard,
        triggerKey: 'webinar_reminder_24h',
        championshipId: webinar.championship_id,
        webinarId: webinar.id,
      };

      await enqueueMessage(job);
    }
  }
}

export async function fireManualTrigger(
  triggerKey: string,
  championshipId: number | null = null
): Promise<number> {
  const template = getTemplateForTrigger(triggerKey);
  if (!template) {
    throw new Error(`No template for trigger: ${triggerKey}`);
  }

  const users = await getNotificationRecipients();
  let queued = 0;
  const dispatchId = `manual_${Date.now()}`;

  for (const user of users) {
    await enqueueMessage({
      telegramId: user.telegram_id,
      text: template.text,
      keyboard: template.keyboard,
      triggerKey,
      championshipId,
      dispatchId,
    });

    queued++;
  }

  return queued;
}

export async function broadcastMessage(
  text: string,
  keyboard: { text: string; url: string }[][] = []
): Promise<number> {
  const users = await getAllActiveUsers();
  let queued = 0;

  for (const user of users) {
    await enqueueMessage({
      telegramId: user.telegram_id,
      text,
      keyboard,
      triggerKey: `broadcast_${Date.now()}`,
      championshipId: null,
    });
    queued++;
  }

  return queued;
}
