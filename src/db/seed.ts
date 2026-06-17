import { pool } from './pool';
import { createChampionship } from './models/championship';
import { createTrigger } from './models/trigger';
import { addDays } from 'date-fns';

async function seed() {
  console.log('Seeding database...');

  const launchDate = addDays(new Date(), 5);
  launchDate.setHours(10, 0, 0, 0);

  const endDate = addDays(launchDate, 56); // 8 weeks

  const champ = await createChampionship(
    'Finam Collab Championship #1',
    launchDate,
    endDate,
    '300 000 ₽'
  );

  console.log(`Created championship: ${champ.name} (ID: ${champ.id})`);

  const triggers = [
    {
      key: 'pre_launch_3d',
      name: '3 дня до старта',
      scheduledAt: addDays(launchDate, -3),
    },
    {
      key: 'pre_launch_1d',
      name: '1 день до старта',
      scheduledAt: addDays(launchDate, -1),
    },
    {
      key: 'pre_launch_start',
      name: 'День старта (11:00 МСК)',
      scheduledAt: new Date(launchDate.getTime() + 60 * 60 * 1000),
    },
    {
      key: 'mid_champ_early_selection',
      name: 'Середина чемпионата',
      scheduledAt: addDays(launchDate, 28),
    },
  ];

  for (const t of triggers) {
    await createTrigger(t.key, t.name, champ.id, t.scheduledAt);
    console.log(`  Created trigger: ${t.key}`);
  }

  // Create weekly leaderboard triggers
  for (let week = 1; week <= 8; week++) {
    const dayOfWeek = launchDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
    const monday = addDays(launchDate, daysUntilMonday + (week - 1) * 7);
    monday.setHours(10, 0, 0, 0);

    if (monday < endDate) {
      await createTrigger(
        'weekly_leaderboard_update',
        `Еженедельный лидерборд (неделя ${week})`,
        champ.id,
        monday
      );
      console.log(`  Created weekly trigger: week ${week}`);
    }
  }

  console.log('✅ Seeding completed');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
