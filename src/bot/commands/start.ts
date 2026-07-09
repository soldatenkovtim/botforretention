import { Context } from 'telegraf';
import { upsertUser } from '../../db/models/user';
import { getLaunchBotMessage } from '../../triggers/templates';

export async function handleStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;
  const username = ctx.from!.username || null;

  await upsertUser(telegramId, username);

  const { text, keyboard } = getLaunchBotMessage();

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard.map((row) =>
        row.map((btn) =>
          btn.callback_data
            ? { text: btn.text, callback_data: btn.callback_data }
            : { text: btn.text, url: btn.url! }
        )
      ),
    },
  });
}
