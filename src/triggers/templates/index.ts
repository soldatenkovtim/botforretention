import { env } from '../../config/env';
import { WebinarEvent } from '../../db/models/webinar';

export interface MessageTemplate {
  text: string;
  keyboard: { text: string; url: string }[][];
}

export function getLaunchBotMessage(): MessageTemplate {
  return {
    text: `👋 Добро пожаловать в Финам Коллаб

Здесь мы ищем таланты и проверяем идеи в условиях, максимально приближенных к реальному хедж-фонду.

Что тебя ждет:
⏱ 8 недель челленджей на рынках США
🏆 Призовой фонд 300 000 ₽ для каждой лиги + карьерные офферы
🤖 Доступ к Зиплайм (платформа для алготрейдинга без программирования)

Выбери свой путь в меню ниже или жди пуш-уведомлений. Поехали! 🚀`,
    keyboard: [
      [{ text: '🚀 Выбрать соревнование', url: env.URL_CHAMPIONSHIPS }],
      [{ text: '💬 Вступить в комьюнити', url: env.URL_COMMUNITY }],
      [{ text: '📚 Правила', url: env.URL_RULES }],
    ],
  };
}

export function getPreLaunch3dMessage(): MessageTemplate {
  return {
    text: `⏳ До старта осталось 3 дня!

Чтобы в день Х ты сразу начал зарабатывать баллы, а не разбирался с интерфейсом, пройди чек-лист:

✅ Не умеешь программировать? Зайди в Зиплайм. ИИ поможет превратить твою ручную стратегию в код за пару часов.
✅ Уже пишешь код? Проверь документацию TradeAPI и подготовь окружение.
✅ Есть вопросы? Заходи в чат. Там уже сидят менторы и участники, готовые помочь.

Не откладывай на последний день 😉`,
    keyboard: [
      [{ text: '🛠 Попробовать Зиплайм (без кода)', url: env.URL_ZIPLYME }],
      [{ text: '💻 Документация TradeAPI', url: env.URL_TRADEAPI_DOCS }],
      [{ text: '👥 Задать вопрос в чате', url: env.URL_COMMUNITY }],
    ],
  };
}

export function getPreLaunch1dMessage(): MessageTemplate {
  return {
    text: `⚡️ Завтра старт! Готовность №1.

Напоминаем: наш скоринг оценивает не только голую доходность. Экспертная команда смотрит на 5 метрик:

1️⃣ Производительность (return on risk)
2️⃣ Стабильность PnL
3️⃣ Контроль просадки
4️⃣ Дисциплина портфеля
5️⃣ Качество исполнения (учет спредов и проскальзываний)

Интуиция здесь не пройдет. Побеждает система.`,
    keyboard: [
      [{ text: '📊 Изучить правила', url: env.URL_RULES }],
      [{ text: '🎯 Войти в личный кабинет', url: env.URL_DASHBOARD }],
    ],
  };
}

export function getPreLaunchStartMessage(): MessageTemplate {
  return {
    text: `🏁 Чемпионат официально открыт!

Таймер на 8 недель запущен. Твой перформанс — это заявка на карьеру в квант-финансах и призовой фонд 300 000 ₽.

Твои первые шаги прямо сейчас:
1. Проверь, что всё работает
2. Запусти первую стратегию (в Зиплайм или через TradeAPI)
3. Получи первый результат

Увидимся на лидерборде в следующий понедельник!`,
    keyboard: [
      [{ text: '▶️ Запустить стратегию', url: env.URL_ZIPLYME }],
      [{ text: '📈 Смотреть лидерборд', url: env.URL_LEADERBOARD }],
    ],
  };
}

export function getWeeklyLeaderboardMessage(): MessageTemplate {
  return {
    text: `📊 Новая неделя — новые инсайты.

Лидерборд обновлен! На этой неделе в топе те, кто жестко контролировал просадку, а не гнался за агрессивным плечом. Дисциплина > Жадность.

💡 Важно: Экспертная команда начинает ранний отбор талантов уже с 4-й недели. Не жди финала, чтобы заявить о себе.

Проверь свои метрики (Sharpe, Drawdown, Win Rate)`,
    keyboard: [
      [{ text: '🏆 Проверить свой рейтинг', url: env.URL_LEADERBOARD }],
      [{ text: '💬 Обсудить в чате', url: env.URL_COMMUNITY }],
    ],
  };
}

export function getWebinarReminderMessage(webinar: WebinarEvent): MessageTemplate {
  const time = new Date(webinar.scheduled_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });

  return {
    text: `🎓 Завтра закрытый вебинар: "${webinar.title}"

Спикер: ${webinar.speaker_name}

Разберем:
- Как избежать переобучения на исторических данных
- Разбор реальных кейсов участников чемпионата
- Ответы на ваши вопросы

⏰ Завтра в ${time} МСК.
🔔 Подключайся`,
    keyboard: [
      ...(webinar.calendar_link
        ? [[{ text: '🔔 Добавить в календарь', url: webinar.calendar_link }]]
        : []),
      ...(webinar.question_link
        ? [[{ text: '❓ Отправить вопрос спикеру', url: webinar.question_link }]]
        : []),
    ],
  };
}

export function getMidChampMessage(): MessageTemplate {
  return {
    text: `🔍 Прошла половина чемпионата.

Команда квантов Финама уже начинает присматриваться к стратегиям, которые показывают стабильный результат, даже если ты пока не в абсолютном топе.

Не бросай на полпути! Доведи стратегию до ума, используя фидбек из комьюнити. Возможно, мы свяжемся с тобой раньше финала.`,
    keyboard: [
      [{ text: '🤝 Перейти в комьюнити', url: env.URL_COMMUNITY }],
      [{ text: '📈 Смотреть лидерборд', url: env.URL_LEADERBOARD }],
    ],
  };
}

export function getChampClosedMessage(): MessageTemplate {
  return {
    text: `🏁 Чемпионат завершен! Спасибо за игру.

8 недель, тысячи сделок, сотни алгоритмов. Эксперты завершили закрытое ревью. Мы смотрели не только на цифры, но и на логику ваших стратегий.

🏆 Поздравляем победителей!

Что дальше? Твои следующие шаги:
💼 Топ-перформерам: С вами свяжется команда для обсуждения оффера в Финам и интро к партнерским фондам.
🚀 Всем участникам: Доступ к Зиплайм остается с тобой. Продолжай строить трек-рекорд!

Это был не последний чемпионат.`,
    keyboard: [
      [{ text: '🏅 Итоги и имена победителей', url: env.URL_RESULTS }],
      [{ text: '💼 Карьерный трек / Партнерство', url: env.URL_CAREERS }],
      [{ text: '🔄 Участвовать в багбаунти', url: env.URL_BUGBOUNTY }],
      [{ text: '🔄 Поделиться идеей с Зиплайм', url: env.URL_ZIPLYME_SUBMIT }],
    ],
  };
}
