import { pool } from '../pool';

export interface Trigger {
  id: number;
  trigger_key: string;
  name: string;
  scheduled_at: Date | null;
  championship_id: number;
  fired_at: Date | null;
  created_at: Date;
}

export async function createTrigger(
  triggerKey: string,
  name: string,
  championshipId: number,
  scheduledAt: Date | null = null
): Promise<Trigger> {
  const result = await pool.query<Trigger>(
    `INSERT INTO triggers (trigger_key, name, championship_id, scheduled_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [triggerKey, name, championshipId, scheduledAt]
  );
  return result.rows[0];
}

export async function getDueTriggers(now: Date): Promise<Trigger[]> {
  const result = await pool.query<Trigger>(
    `SELECT * FROM triggers
     WHERE fired_at IS NULL
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= $1
     ORDER BY scheduled_at ASC`,
    [now]
  );
  return result.rows;
}

export async function markTriggerFired(triggerId: number): Promise<void> {
  await pool.query(
    'UPDATE triggers SET fired_at = NOW() WHERE id = $1',
    [triggerId]
  );
}

export async function getTriggerByKey(
  triggerKey: string,
  championshipId: number
): Promise<Trigger | null> {
  const result = await pool.query<Trigger>(
    'SELECT * FROM triggers WHERE trigger_key = $1 AND championship_id = $2',
    [triggerKey, championshipId]
  );
  return result.rows[0] || null;
}

export async function getTriggersForChampionship(championshipId: number): Promise<Trigger[]> {
  const result = await pool.query<Trigger>(
    'SELECT * FROM triggers WHERE championship_id = $1 ORDER BY scheduled_at ASC NULLS LAST',
    [championshipId]
  );
  return result.rows;
}

export async function getTriggerStats(): Promise<{
  total: number;
  pending: number;
  fired: number;
  due: number;
}> {
  const result = await pool.query<{
    total: string;
    pending: string;
    fired: string;
    due: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE fired_at IS NULL) AS pending,
       COUNT(*) FILTER (WHERE fired_at IS NOT NULL) AS fired,
       COUNT(*) FILTER (WHERE fired_at IS NULL AND scheduled_at <= NOW()) AS due
     FROM triggers`
  );

  const row = result.rows[0];
  return {
    total: Number(row.total),
    pending: Number(row.pending),
    fired: Number(row.fired),
    due: Number(row.due),
  };
}
