import { pool } from '../pool';

export interface Championship {
  id: number;
  name: string;
  launch_date: Date;
  end_date: Date;
  prize_pool: string;
  created_at: Date;
}

export async function createChampionship(
  name: string,
  launchDate: Date,
  endDate: Date,
  prizePool: string = '300 000 ₽'
): Promise<Championship> {
  const result = await pool.query<Championship>(
    `INSERT INTO championships (name, launch_date, end_date, prize_pool)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, launchDate, endDate, prizePool]
  );
  return result.rows[0];
}

export async function getChampionshipById(id: number): Promise<Championship | null> {
  const result = await pool.query<Championship>(
    'SELECT * FROM championships WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getActiveChampionships(): Promise<Championship[]> {
  const result = await pool.query<Championship>(
    'SELECT * FROM championships WHERE end_date > NOW() ORDER BY launch_date ASC'
  );
  return result.rows;
}

export async function getAllChampionships(): Promise<Championship[]> {
  const result = await pool.query<Championship>(
    'SELECT * FROM championships ORDER BY launch_date DESC'
  );
  return result.rows;
}

export async function getChampionshipAdminStats(): Promise<Array<{
  id: number;
  name: string;
  launch_date: Date;
  end_date: Date;
  prize_pool: string;
  users_count: number;
  triggers_count: number;
}>> {
  const result = await pool.query<{
    id: number;
    name: string;
    launch_date: Date;
    end_date: Date;
    prize_pool: string;
    users_count: string;
    triggers_count: string;
  }>(
    `SELECT
       c.id,
       c.name,
       c.launch_date,
       c.end_date,
       c.prize_pool,
       COUNT(DISTINCT u.telegram_id) AS users_count,
       COUNT(DISTINCT t.id) AS triggers_count
     FROM championships c
     LEFT JOIN users u ON u.championship_id = c.id
     LEFT JOIN triggers t ON t.championship_id = c.id
     GROUP BY c.id
     ORDER BY c.launch_date DESC`
  );

  return result.rows.map((row) => ({
    ...row,
    users_count: Number(row.users_count),
    triggers_count: Number(row.triggers_count),
  }));
}
