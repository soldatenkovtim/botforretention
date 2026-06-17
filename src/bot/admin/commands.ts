import { Context, Telegraf } from 'telegraf';
import { fireManualTrigger, broadcastMessage } from '../../triggers/triggerService';
import { createChampionship } from '../../db/models/championship';
import { createWebinar } from '../../db/models/webinar';
import { createTrigger } from '../../db/models/trigger';
import { adminOnly } from './middleware';

const MSK = 'Europe/Moscow';

interface AdminSession {
  step: string;
  data: Record<string, any>;
}

const sessions = new Map<number, AdminSession>();

export function registerAdminCommands(bot: Telegraf): void {
  bot.command('admin', adminOnly, async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const subcommand = args[0];

    if (!subcommand) {
      await ctx.reply(
        `🔐 Админ-панель:

/admin fire_trigger <trigger_key> <championship_id>
/admin add_championship
/admin add_webinar
/admin broadcast <message>`
      );
      return;
    }

    switch (subcommand) {
      case 'fire_trigger':
        await handleFireTrigger(ctx, args.slice(1));
        break;
      case 'add_championship':
        await startAddChampionship(ctx);
        break;
      case 'add_webinar':
        await startAddWebinar(ctx);
        break;
      case 'broadcast':
        await handleBroadcast(ctx, args.slice(1).join(' '));
        break;
      default:
        await ctx.reply('❌ Неизвестная команда. Используй /admin для справки.');
    }
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const session = sessions.get(userId);

    if (!session) return next();

    await processWizardStep(ctx, session);
  });
}

async function handleFireTrigger(ctx: Context, args: string[]): Promise<void> {
  if (args.length < 2) {
    await ctx.reply('Использование: /admin fire_trigger <trigger_key> <championship_id>');
    return;
  }

  const [triggerKey, champIdStr] = args;
  const championshipId = parseInt(champIdStr, 10);

  if (isNaN(championshipId)) {
    await ctx.reply('❌ championship_id должен быть числом');
    return;
  }

  try {
    const count = await fireManualTrigger(triggerKey, championshipId);
    await ctx.reply(`✅ Триггер "${triggerKey}" запущен. Отправляется ${count} пользователям.`);
  } catch (error: any) {
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
}

async function startAddChampionship(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  sessions.set(userId, {
    step: 'champ_name',
    data: {},
  });
  await ctx.reply('📝 Создание чемпионата\n\nВведи название чемпионата:');
}

async function startAddWebinar(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  sessions.set(userId, {
    step: 'webinar_champ_id',
    data: {},
  });
  await ctx.reply('📝 Добавление вебинара\n\nВведи ID чемпионата:');
}

async function handleBroadcast(ctx: Context, message: string): Promise<void> {
  if (!message.trim()) {
    await ctx.reply('Использование: /admin broadcast <сообщение>');
    return;
  }

  const count = await broadcastMessage(message);
  await ctx.reply(`✅ Рассылка запущена. Отправляется ${count} пользователям.`);
}

async function processWizardStep(ctx: Context & { message: { text: string } }, session: AdminSession): Promise<void> {
  const userId = ctx.from!.id;
  const text = ctx.message.text;

  if (text === '/cancel') {
    sessions.delete(userId);
    await ctx.reply('❌ Операция отменена.');
    return;
  }

  switch (session.step) {
    case 'champ_name':
      session.data.name = text;
      session.step = 'champ_launch_date';
      await ctx.reply('Введи дату старта (формат: YYYY-MM-DD):');
      break;

    case 'champ_launch_date':
      const launchDate = new Date(text + 'T10:00:00+03:00');
      if (isNaN(launchDate.getTime())) {
        await ctx.reply('❌ Неверный формат даты. Используй YYYY-MM-DD:');
        return;
      }
      session.data.launchDate = launchDate;
      session.step = 'champ_end_date';
      await ctx.reply('Введи дату окончания (формат: YYYY-MM-DD):');
      break;

    case 'champ_end_date':
      const endDate = new Date(text + 'T23:59:59+03:00');
      if (isNaN(endDate.getTime())) {
        await ctx.reply('❌ Неверный формат даты. Используй YYYY-MM-DD:');
        return;
      }
      session.data.endDate = endDate;
      session.step = 'champ_prize';
      await ctx.reply('Введи призовой фонд (или отправь - для значения по умолчанию "300 000 ₽"):');
      break;

    case 'champ_prize':
      const prize = text === '-' ? '300 000 ₽' : text;
      try {
        const champ = await createChampionship(
          session.data.name,
          session.data.launchDate,
          session.data.endDate,
          prize
        );

        await createScheduledTriggers(champ.id, session.data.launchDate, session.data.endDate);

        sessions.delete(userId);
        await ctx.reply(
          `✅ Чемпионат создан!\n\nID: ${champ.id}\nНазвание: ${champ.name}\nСтарт: ${session.data.launchDate.toISOString()}\nФиниш: ${session.data.endDate.toISOString()}\nПриз: ${prize}\n\nВсе стандартные триггеры запланированы.`
        );
      } catch (error: any) {
        sessions.delete(userId);
        await ctx.reply(`❌ Ошибка создания: ${error.message}`);
      }
      break;

    case 'webinar_champ_id':
      const champId = parseInt(text, 10);
      if (isNaN(champId)) {
        await ctx.reply('❌ ID должен быть числом:');
        return;
      }
      session.data.championshipId = champId;
      session.step = 'webinar_title';
      await ctx.reply('Введи название вебинара:');
      break;

    case 'webinar_title':
      session.data.title = text;
      session.step = 'webinar_speaker';
      await ctx.reply('Введи имя спикера:');
      break;

    case 'webinar_speaker':
      session.data.speakerName = text;
      session.step = 'webinar_datetime';
      await ctx.reply('Введи дату и время (формат: YYYY-MM-DD HH:MM, время МСК):');
      break;

    case 'webinar_datetime':
      const dateTime = new Date(text.replace(' ', 'T') + ':00+03:00');
      if (isNaN(dateTime.getTime())) {
        await ctx.reply('❌ Неверный формат. Используй YYYY-MM-DD HH:MM:');
        return;
      }
      session.data.scheduledAt = dateTime;
      session.step = 'webinar_links';
      await ctx.reply('Введи ссылку на Zoom/YouTube (или - чтобы пропустить):');
      break;

    case 'webinar_links':
      session.data.zoomLink = text === '-' ? null : text;
      try {
        const webinar = await createWebinar(
          session.data.championshipId,
          session.data.title,
          session.data.speakerName,
          session.data.scheduledAt,
          { zoom_link: session.data.zoomLink }
        );
        sessions.delete(userId);
        await ctx.reply(
          `✅ Вебинар добавлен!\n\nID: ${webinar.id}\nНазвание: ${webinar.title}\nСпикер: ${webinar.speaker_name}\nДата: ${session.data.scheduledAt.toISOString()}`
        );
      } catch (error: any) {
        sessions.delete(userId);
        await ctx.reply(`❌ Ошибка: ${error.message}`);
      }
      break;
  }
}

async function createScheduledTriggers(
  championshipId: number,
  launchDate: Date,
  endDate: Date
): Promise<void> {
  const triggers = [
    {
      key: 'pre_launch_3d',
      name: '3 дня до старта',
      scheduledAt: new Date(launchDate.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      key: 'pre_launch_1d',
      name: '1 день до старта',
      scheduledAt: new Date(launchDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      key: 'pre_launch_start',
      name: 'День старта',
      scheduledAt: new Date(launchDate.getTime() + 1 * 60 * 60 * 1000), // +1h = 11:00 MSK
    },
    {
      key: 'mid_champ_early_selection',
      name: 'Середина чемпионата (4 неделя)',
      scheduledAt: new Date(launchDate.getTime() + 28 * 24 * 60 * 60 * 1000),
    },
  ];

  // Weekly leaderboard updates: every Monday at 10:00 MSK during championship
  const current = new Date(launchDate);
  const dayOfWeek = current.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const firstMonday = new Date(current.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);

  let monday = firstMonday;
  let weekNum = 1;
  while (monday < endDate) {
    triggers.push({
      key: 'weekly_leaderboard_update',
      name: `Еженедельный лидерборд (неделя ${weekNum})`,
      scheduledAt: new Date(monday),
    });
    monday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
    weekNum++;
  }

  for (const t of triggers) {
    await createTrigger(t.key, t.name, championshipId, t.scheduledAt);
  }
}
