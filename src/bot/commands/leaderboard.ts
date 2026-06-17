import { Context } from 'telegraf';
import { env } from '../../config/env';

export async function handleLeaderboard(ctx: Context): Promise<void> {
  await ctx.reply('🏆 Актуальный лидерборд доступен по ссылке:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📈 Открыть лидерборд', url: env.URL_LEADERBOARD }],
      ],
    },
  });
}
