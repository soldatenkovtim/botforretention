import { Context } from 'telegraf';
import { getUserByTelegramId } from '../../db/models/user';
import { getChampionshipById } from '../../db/models/championship';
import { env } from '../../config/env';

export async function handleStatus(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;
  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Ты ещё не зарегистрирован. Отправь /start чтобы начать.');
    return;
  }

  if (!user.championship_id) {
    await ctx.reply(
      '📋 Ты зарегистрирован, но пока не участвуешь в чемпионате.\n\nВыбери соревнование:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Выбрать соревнование', url: env.URL_CHAMPIONSHIPS }],
          ],
        },
      }
    );
    return;
  }

  const championship = await getChampionshipById(user.championship_id);

  const stateLabels: Record<string, string> = {
    pre_launch: '⏳ Ожидание старта',
    active: '🟢 Активный',
    finished: '🏁 Завершен',
  };

  const statusText = `📊 Твой статус:

🏆 Чемпионат: ${championship?.name || 'Неизвестно'}
📈 Лига: ${user.league === 'algo' ? '🤖 Алго' : user.league === 'manual' ? '✋ Ручная' : 'Не выбрана'}
🔄 Состояние: ${stateLabels[user.state] || user.state}
📅 Зарегистрирован: ${new Date(user.registered_at).toLocaleDateString('ru-RU')}`;

  await ctx.reply(statusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📈 Смотреть лидерборд', url: env.URL_LEADERBOARD }],
        [{ text: '🎯 Личный кабинет', url: env.URL_DASHBOARD }],
      ],
    },
  });
}
