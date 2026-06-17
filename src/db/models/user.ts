import { pool } from '../pool';

export interface User {
  telegram_id: number;
  username: string | null;
  championship_id: number | null;
  league: 'algo' | 'manual' | null;
  registered_at: Date;
  state: 'pre_launch' | 'active' | 'finished';
  is_active: boolean;
}

export async function upsertUser(
  telegramId: number,
  username: string | null
): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (telegram_id, username)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING *`,
    [telegramId, username]
  );
  return result.rows[0];
}

export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const result = await pool.query<User>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

export async function getUsersByChampionship(championshipId: number): Promise<User[]> {
  const result = await pool.query<User>(
    'SELECT * FROM users WHERE championship_id = $1 AND is_active = TRUE',
    [championshipId]
  );
  return result.rows;
}

export async function getAllActiveUsers(): Promise<User[]> {
  const result = await pool.query<User>(
    'SELECT * FROM users WHERE is_active = TRUE'
  );
  return result.rows;
}

export async function getUsersForAdmin(
  limit: number | null = null,
  championshipId?: number
): Promise<User[]> {
  if (limit === null) {
    const result = await pool.query<User>(
      `SELECT * FROM users
       WHERE ($1::INTEGER IS NULL OR championship_id = $1)
       ORDER BY registered_at DESC`,
      [championshipId || null]
    );
    return result.rows;
  }

  const result = await pool.query<User>(
    `SELECT * FROM users
     WHERE ($1::INTEGER IS NULL OR championship_id = $1)
     ORDER BY registered_at DESC
     LIMIT $2`,
    [championshipId || null, limit]
  );
  return result.rows;
}

export async function getUserStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  with_championship: number;
}> {
  const result = await pool.query<{
    total: string;
    active: string;
    inactive: string;
    with_championship: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_active = TRUE) AS active,
       COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive,
       COUNT(*) FILTER (WHERE championship_id IS NOT NULL) AS with_championship
     FROM users`
  );

  const row = result.rows[0];
  return {
    total: Number(row.total),
    active: Number(row.active),
    inactive: Number(row.inactive),
    with_championship: Number(row.with_championship),
  };
}

export async function markUserInactive(telegramId: number): Promise<void> {
  await pool.query(
    'UPDATE users SET is_active = FALSE WHERE telegram_id = $1',
    [telegramId]
  );
}

export async function updateUserState(
  telegramId: number,
  state: User['state']
): Promise<void> {
  await pool.query(
    'UPDATE users SET state = $1 WHERE telegram_id = $2',
    [state, telegramId]
  );
}

export async function setUserChampionship(
  telegramId: number,
  championshipId: number,
  league?: 'algo' | 'manual'
): Promise<void> {
  await pool.query(
    'UPDATE users SET championship_id = $1, league = $2 WHERE telegram_id = $3',
    [championshipId, league || null, telegramId]
  );
}
