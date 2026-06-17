import { Telegraf } from 'telegraf';
import { env } from './config/env';
import { handleStart } from './bot/commands/start';
import { handleStatus } from './bot/commands/status';
import { handleLeaderboard } from './bot/commands/leaderboard';
import { handleHelp } from './bot/commands/help';
import { registerAdminCommands } from './bot/admin/commands';
import { initMessageQueue, closeQueue } from './queue/messageQueue';
import { startScheduler } from './scheduler/cron';

async function main() {
  const bot = new Telegraf(env.BOT_TOKEN);

  initMessageQueue(env.REDIS_URL, bot);

  bot.command('start', handleStart);
  bot.command('status', handleStatus);
  bot.command('leaderboard', handleLeaderboard);
  bot.command('help', handleHelp);

  registerAdminCommands(bot);

  startScheduler();

  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
  });

  process.once('SIGINT', () => gracefulShutdown(bot));
  process.once('SIGTERM', () => gracefulShutdown(bot));

  await bot.launch();
  console.log('🤖 Finam Collab Bot started');
}

async function gracefulShutdown(bot: Telegraf) {
  console.log('Shutting down...');
  bot.stop('SIGTERM');
  await closeQueue();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
