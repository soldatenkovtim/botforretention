import { Context, Telegraf } from 'telegraf';
import { fireManualTrigger, broadcastMessage } from '../../triggers/triggerService';
import { KeyboardButton } from '../../queue/messageQueue';
import { createChampionship, getChampionshipAdminStats } from '../../db/models/championship';
import { createWebinar } from '../../db/models/webinar';
import { createTrigger, getTriggersForChampionship, getTriggerStats } from '../../db/models/trigger';
import { getSentMessageStats } from '../../db/models/sentMessage';
import { getUsersForAdmin, getUserStats } from '../../db/models/user';
import { adminOnly } from './middleware';
import {
  getPreLaunch3dMessage,
  getPreLaunch1dMessage,
  getPreLaunchStartMessage,
  getWeeklyLeaderboardMessage,
  getStagnationAlertMessage,
  getMidChampMessage,
  getChampClosedMessage,
} from '../../triggers/templates';

const MSK = 'Europe/Moscow';

function buildTriggerHelp(): string {
  const preview = (text: string, maxLen = 120): string => {
    const firstLine = text.split('\n').filter((l) => l.trim()).slice(0, 3).join(' ').trim();
    return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '…' : firstLine;
  };

  const btnLabels = (keyboard: { text: string }[][]): string =>
    keyboard.flat().map((b) => b.text).join(' | ');

  const entries: { when: string; key: string; template: ReturnType<typeof getPreLaunch3dMessage> }[] = [
    { when: 'За 3 дня до старта', key: 'pre_launch_3d', template: getPreLaunch3dMessage() },
    { when: 'За 1 день до старта', key: 'pre_launch_1d', template: getPreLaunch1dMessage() },
    { when: 'В день старта, 16:30 МСК', key: 'pre_launch_start', template: getPreLaunchStartMessage() },
    {
      when: 'Каждый понедельник, 16:30 МСК\n   ⚠️ Перед отправкой подставь реальные данные через /admin broadcast',
      key: 'weekly_leaderboard_update',
      template: getWeeklyLeaderboardMessage(),
    },
    {
      when: 'Вторник — если у участника нет активности 7 дней',
      key: 'stagnation_alert',
      template: getStagnationAlertMessage(),
    },
    { when: '4-я неделя чемпионата', key: 'mid_champ_early_selection', template: getMidChampMessage() },
    { when: 'После публикации финальных итогов', key: 'champ_closed_results', template: getChampClosedMessage() },
  ];

  const lines: string[] = ['📅 ПЛАН РАССЫЛОК — что когда отправлять\n'];

  entries.forEach(({ when, key, template }, i) => {
    lines.push(
      `${'─'.repeat(32)}\n` +
      `${i + 1}️⃣  ${when}\n` +
      `Команда: /admin fire_trigger ${key}\n\n` +
      `Превью текста:\n«${preview(template.text)}»\n\n` +
      `Кнопки: ${btnLabels(template.keyboard)}`
    );
  });

  return lines.join('\n\n');
}

const ADMIN_HELP = `🔐 Финам Коллаб — Админ-панель

━━━━━━━━━━━━━━━━━━━━
📨 РАССЫЛКИ
━━━━━━━━━━━━━━━━━━━━
/admin fire_trigger <trigger_key>
  Отправить шаблонное уведомление всем активным пользователям.
  Пример: /admin fire_trigger pre_launch_3d
  ⚠️ Всегда отправляет заново — даже если уже отправлялось.

/admin trigger_keys
  Показать план рассылок: когда, какая команда, превью текста и кнопок.

/admin broadcast <текст>
  Отправить произвольный текст всем активным пользователям.
  Используй для еженедельного лидерборда с реальными данными.
  Пример: /admin broadcast 📊 Итоги недели: 1. @user1 — +12.3% ...

━━━━━━━━━━━━━━━━━━━━
⚙️ СОЗДАНИЕ
━━━━━━━━━━━━━━━━━━━━
/admin add_championship
  Создать новый чемпионат (название, даты, призовой фонд).

/admin add_webinar
  Добавить вебинар к чемпионату — за 24 часа бот пришлёт напоминание.

━━━━━━━━━━━━━━━━━━━━
📊 ПРОСМОТР
━━━━━━━━━━━━━━━━━━━━
/admin stats       — сводная статистика (юзеры, триггеры, сообщения)
/admin championships — список чемпионатов с датами
/admin triggers <id> — триггеры конкретного чемпионата и их статус
/admin users       — список всех пользователей
/users             — то же самое, короткая команда`;

interface AdminSession {
  step: string;
  data: Record<string, any>;
}

const sessions = new Map<number, AdminSession>();

export function registerAdminCommands(bot: Telegraf): void {
  bot.command('users', adminOnly, async (ctx) => {
    await handleUsers(ctx);
  });

  bot.command('admin', adminOnly, async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const subcommand = args[0];

    if (!subcommand) {
      await ctx.reply(ADMIN_HELP);
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
      case 'trigger_keys':
        await ctx.reply(buildTriggerHelp());
        break;
      case 'users':
        await handleUsers(ctx);
        break;
      case 'championships':
        await handleChampionships(ctx);
        break;
      case 'triggers':
        await handleTriggers(ctx, args.slice(1));
        break;
      case 'stats':
        await handleStats(ctx);
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

const LEAGUE_INPUT_HINT = `Введи 3 строки, каждая с новой строки.
Формат: Никнейм, P/L

Пример:
Миша, +40%
Носок, +30%
Алефтинка, +1%

Отправь /cancel чтобы прервать.`;

async function handleFireTrigger(ctx: Context, args: string[]): Promise<void> {
  if (args.length < 1) {
    await ctx.reply(`Использование: /admin fire_trigger <trigger_key>\n\n${buildTriggerHelp()}`);
    return;
  }

  const [triggerKey, champIdStr] = args;
  const championshipId = champIdStr ? parseInt(champIdStr, 10) : null;

  if (champIdStr && isNaN(championshipId!)) {
    await ctx.reply('❌ championship_id должен быть числом. Можно вообще не указывать его.');
    return;
  }

  if (triggerKey === 'weekly_leaderboard_update') {
    await startLeaderboardWizard(ctx);
    return;
  }

  try {
    const count = await fireManualTrigger(triggerKey, championshipId);
    await ctx.reply(
      `✅ Ручной триггер "${triggerKey}" запущен.

Получатели: ${count} активных пользователей бота.
Повторный запуск этой же команды снова отправит сообщение.`
    );
  } catch (error: any) {
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
}

async function startLeaderboardWizard(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  sessions.set(userId, { step: 'leaderboard_alpha', data: {} });
  await ctx.reply(
    `📊 Еженедельный лидерборд — ввод данных\n\n` +
    `Шаг 1 из 3: 🅰️ Альфа-лига\n\n${LEAGUE_INPUT_HINT}`
  );
}

function parseLeagueEntries(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)
    .map((line, i) => {
      const stripped = line.replace(/^\d+[.)]\s*/, '').trim();
      const commaIdx = stripped.lastIndexOf(',');
      if (commaIdx > 0) {
        const name = stripped.slice(0, commaIdx).trim();
        const pl = stripped.slice(commaIdx + 1).trim();
        return `${i + 1}. ${name} — ${pl}`;
      }
      return `${i + 1}. ${stripped}`;
    });
}

function buildLeaderboardText(alpha: string[], beta: string[], manual: string[]): string {
  return `📊 Итоги недели: рейтинг обновлён

🏆 ТОП-3 ПО ЛИГАМ

🅰️ Альфа-лига. Номинация «В погоне за чистой альфой» — маркет-нейтральные стратегии
${alpha.join('\n')}

🅱️ Бета-лига. Номинация «Опережение бенчмарка» — направленные стратегии, обгоняющие рынок
${beta.join('\n')}

🖐️ Ручная лига. Номинация «Ручной трейдинг» — классическая торговля руками
${manual.join('\n')}

⚡ С 4-й недели команда квантов Финам начинает ранний отбор талантов. Мы оцениваем не только P/L но и стабильность, контроль просадки, дисциплину и качество исполнения.

💰 Напоминаем о призах:
• 900 000 ₽ — призовой фонд на брокерские счёта в Финам
• Карьерные офферы в квант-команду для топ-перформеров
• Интро к партнёрским фондам для авторов лучших стратегий`;
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

async function handleUsers(ctx: Context): Promise<void> {
  const users = await getUsersForAdmin(null);

  if (users.length === 0) {
    await ctx.reply('Пользователей пока нет.');
    return;
  }

  const lines = users.map((user) => {
    const username = user.username ? `@${user.username}` : 'без username';
    const active = user.is_active ? 'активен' : 'неактивен';
    const registeredAt = formatMsk(user.registered_at);
    return `• ${user.telegram_id} (${username}) — ${active}, с ${registeredAt}`;
  });

  await replyInChunks(
    ctx,
    `👥 Пользователи бота: ${users.length}\n\n`,
    lines
  );
}

async function handleChampionships(ctx: Context): Promise<void> {
  const championships = await getChampionshipAdminStats();

  if (championships.length === 0) {
    await ctx.reply('Чемпионатов пока нет. Создай первый через /admin add_championship');
    return;
  }

  const lines = championships.map((championship) => {
    return [
      `#${championship.id} ${championship.name}`,
      `старт: ${formatMsk(championship.launch_date)}`,
      `финиш: ${formatMsk(championship.end_date)}`,
      `аудитория: все активные пользователи бота`,
      `триггеров: ${championship.triggers_count}`,
    ].join('\n');
  });

  await ctx.reply(`🏆 Чемпионаты:\n\n${lines.join('\n\n')}`);
}

async function handleTriggers(ctx: Context, args: string[]): Promise<void> {
  if (!args[0]) {
    await ctx.reply('Использование: /admin triggers <championship_id>');
    return;
  }

  const championshipId = parseInt(args[0], 10);
  if (isNaN(championshipId)) {
    await ctx.reply('❌ championship_id должен быть числом');
    return;
  }

  const triggers = await getTriggersForChampionship(championshipId);

  if (triggers.length === 0) {
    await ctx.reply(`Триггеров для чемпионата #${championshipId} пока нет.`);
    return;
  }

  const lines = triggers.map((trigger) => {
    const status = trigger.fired_at ? `отправлен ${formatMsk(trigger.fired_at)}` : 'ожидает';
    const scheduled = trigger.scheduled_at ? formatMsk(trigger.scheduled_at) : 'без расписания';
    return `• ${trigger.trigger_key}\n  ${trigger.name}\n  когда: ${scheduled}\n  статус: ${status}`;
  });

  await ctx.reply(`⏰ Триггеры чемпионата #${championshipId}:\n\n${lines.join('\n\n')}`);
}

async function handleStats(ctx: Context): Promise<void> {
  const [users, triggers, messages] = await Promise.all([
    getUserStats(),
    getTriggerStats(),
    getSentMessageStats(),
  ]);

  await ctx.reply(
    `📊 Статистика бота:

Пользователи:
• всего: ${users.total}
• активные: ${users.active}
• неактивные: ${users.inactive}

Триггеры:
• всего: ${triggers.total}
• ожидают: ${triggers.pending}
• отправлены: ${triggers.fired}
• просрочены и ждут обработки: ${triggers.due}

Сообщения:
• всего отправлено: ${messages.total}
• за 24 часа: ${messages.last_24h}`
  );
}

function formatMsk(value: Date): string {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: MSK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function replyInChunks(
  ctx: Context,
  header: string,
  lines: string[],
  maxLength: number = 3500
): Promise<void> {
  let chunk = header;

  for (const line of lines) {
    const next = `${chunk}${line}\n`;
    if (next.length > maxLength) {
      await ctx.reply(chunk.trim());
      chunk = `${line}\n`;
      continue;
    }
    chunk = next;
  }

  if (chunk.trim()) {
    await ctx.reply(chunk.trim());
  }
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
    case 'leaderboard_alpha': {
      const entries = parseLeagueEntries(text);
      if (entries.length === 0) {
        await ctx.reply('❌ Не удалось распознать данные. Попробуй ещё раз:\n\n' + LEAGUE_INPUT_HINT);
        return;
      }
      session.data.alpha = entries;
      session.step = 'leaderboard_beta';
      await ctx.reply(`✅ Альфа-лига сохранена.\n\nШаг 2 из 3: 🅱️ Бета-лига\n\n${LEAGUE_INPUT_HINT}`);
      break;
    }

    case 'leaderboard_beta': {
      const entries = parseLeagueEntries(text);
      if (entries.length === 0) {
        await ctx.reply('❌ Не удалось распознать данные. Попробуй ещё раз:\n\n' + LEAGUE_INPUT_HINT);
        return;
      }
      session.data.beta = entries;
      session.step = 'leaderboard_manual';
      await ctx.reply(`✅ Бета-лига сохранена.\n\nШаг 3 из 3: 🖐️ Ручная лига\n\n${LEAGUE_INPUT_HINT}`);
      break;
    }

    case 'leaderboard_manual': {
      const entries = parseLeagueEntries(text);
      if (entries.length === 0) {
        await ctx.reply('❌ Не удалось распознать данные. Попробуй ещё раз:\n\n' + LEAGUE_INPUT_HINT);
        return;
      }
      session.data.manual = entries;
      session.step = 'leaderboard_confirm';
      const preview = buildLeaderboardText(session.data.alpha, session.data.beta, session.data.manual);
      await ctx.reply(
        `✅ Все данные собраны. Вот что получат пользователи:\n\n` +
        `─────────────────────\n${preview}\n─────────────────────\n\n` +
        `Напиши ДА чтобы отправить, или /cancel чтобы отменить.`
      );
      break;
    }

    case 'leaderboard_confirm': {
      if (text.trim().toLowerCase() !== 'да') {
        await ctx.reply('Жду ДА для отправки или /cancel для отмены.');
        return;
      }
      const finalText = buildLeaderboardText(session.data.alpha, session.data.beta, session.data.manual);
      const keyboard: KeyboardButton[][] = getWeeklyLeaderboardMessage().keyboard;
      sessions.delete(userId);
      try {
        const count = await broadcastMessage(finalText, keyboard);
        await ctx.reply(`✅ Лидерборд отправлен ${count} пользователям.`);
      } catch (error: any) {
        await ctx.reply(`❌ Ошибка отправки: ${error.message}`);
      }
      break;
    }

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
