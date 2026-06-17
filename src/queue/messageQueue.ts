import { Queue, Worker } from 'bullmq';
import { Telegraf } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { recordSentMessage } from '../db/models/sentMessage';
import { markUserInactive } from '../db/models/user';

const QUEUE_NAME = 'telegram-messages';

let queue: Queue;
let worker: Worker;

export interface SendMessageJob {
  telegramId: number;
  text: string;
  keyboard: { text: string; url: string }[][];
  triggerKey: string;
  championshipId: number | null;
  webinarId?: number | null;
  dispatchId?: string;
}

export function initMessageQueue(redisUrl: string, bot: Telegraf) {
  const connection = { url: redisUrl };

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker<SendMessageJob>(
    QUEUE_NAME,
    async (job) => {
      const { telegramId, text, keyboard, triggerKey, championshipId, webinarId } = job.data;

      const inlineKeyboard: InlineKeyboardMarkup = {
        inline_keyboard: keyboard.map((row) =>
          row.map((btn) => ({ text: btn.text, url: btn.url }))
        ),
      };

      try {
        await bot.telegram.sendMessage(telegramId, text, {
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        });
      } catch (error: any) {
        if (error?.response?.error_code === 403) {
          await markUserInactive(telegramId);
          return;
        }
        if (error?.response?.error_code === 429) {
          const retryAfter = error.response.parameters?.retry_after || 5;
          throw new Error(`Rate limited, retry after ${retryAfter}s`);
        }
        console.error(`Failed to send message to ${telegramId}:`, error.message);
        throw error;
      }

      try {
        await recordSentMessage(telegramId, triggerKey, championshipId, webinarId || null);
      } catch (error: any) {
        // The Telegram message has already been delivered. Do not retry the job,
        // otherwise the user may receive duplicate messages.
        console.error(`Message sent to ${telegramId}, but delivery record failed:`, error.message);
      }
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 25,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (job && err) {
      console.error(`Job ${job.id} failed:`, err.message);
    }
  });

  return { queue, worker };
}

export async function enqueueMessage(job: SendMessageJob): Promise<void> {
  const jobId = [
    job.telegramId,
    job.triggerKey,
    job.championshipId ?? 'global',
    job.webinarId ?? 'none',
    job.dispatchId ?? 'auto',
  ].join(':');

  await queue.add('send', job, {
    jobId,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export async function closeQueue(): Promise<void> {
  if (worker) await worker.close();
  if (queue) await queue.close();
}
