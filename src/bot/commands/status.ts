import { Context } from 'telegraf';
import { getUserByTelegramId } from '../../db/models/user';
import { env } from '../../config/env';

export async function handleStatus(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;
  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.reply('Ты ещё не зарегистрирован. Отправь /start чтобы начать.');
    return;
  }

  const statusText = `📊 Твой статус:

✅ Ты зарегистрирован в боте Финам Коллаб
🔔 Уведомления: ${user.is_active ? 'включены' : 'отключены'}
📅 Зарегистрирован: ${new Date(user.registered_at).toLocaleDateString('ru-RU')}`;

  await ctx.reply(statusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Выбрать соревнование', url: env.URL_CHAMPIONSHIPS }],
        [{ text: '💬 Вступить в комьюнити', url: env.URL_COMMUNITY }],
      ],
    },
  });
}
