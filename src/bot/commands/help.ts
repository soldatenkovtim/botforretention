import { Context } from 'telegraf';

export async function handleHelp(ctx: Context): Promise<void> {
  const helpText = `📚 Доступные команды:

/start — Регистрация и приветствие
/status — Твой текущий статус в чемпионате
/leaderboard — Быстрая ссылка на лидерборд
/help — Показать это сообщение

Остались вопросы? Заходи в наш чат сообщества!`;

  await ctx.reply(helpText);
}
