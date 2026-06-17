import { pool } from '../pool';

export interface SentMessage {
  id: number;
  telegram_id: number;
  trigger_key: string;
  championship_id: number | null;
  webinar_id: number | null;
  sent_at: Date;
}

export async function hasMessageBeenSent(
  telegramId: number,
  triggerKey: string,
  championshipId: number | null,
  webinarId: number | null = null
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM sent_messages
     WHERE telegram_id = $1
       AND trigger_key = $2
       AND (championship_id = $3 OR ($3 IS NULL AND championship_id IS NULL))
       AND (webinar_id = $4 OR ($4 IS NULL AND webinar_id IS NULL))
     LIMIT 1`,
    [telegramId, triggerKey, championshipId, webinarId]
  );
  return result.rowCount! > 0;
}

export async function recordSentMessage(
  telegramId: number,
  triggerKey: string,
  championshipId: number | null,
  webinarId: number | null = null
): Promise<void> {
  await pool.query(
    `INSERT INTO sent_messages (telegram_id, trigger_key, championship_id, webinar_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [telegramId, triggerKey, championshipId, webinarId]
  );
}

export async function getSentMessageStats(): Promise<{
  total: number;
  last_24h: number;
}> {
  const result = await pool.query<{
    total: string;
    last_24h: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') AS last_24h
     FROM sent_messages`
  );

  const row = result.rows[0];
  return {
    total: Number(row.total),
    last_24h: Number(row.last_24h),
  };
}
