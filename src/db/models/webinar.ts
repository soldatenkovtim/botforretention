import { pool } from '../pool';

export interface WebinarEvent {
  id: number;
  championship_id: number;
  title: string;
  speaker_name: string;
  scheduled_at: Date;
  zoom_link: string | null;
  youtube_link: string | null;
  calendar_link: string | null;
  question_link: string | null;
  created_at: Date;
}

export async function createWebinar(
  championshipId: number,
  title: string,
  speakerName: string,
  scheduledAt: Date,
  links: {
    zoom_link?: string;
    youtube_link?: string;
    calendar_link?: string;
    question_link?: string;
  } = {}
): Promise<WebinarEvent> {
  const result = await pool.query<WebinarEvent>(
    `INSERT INTO webinar_events (championship_id, title, speaker_name, scheduled_at, zoom_link, youtube_link, calendar_link, question_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      championshipId,
      title,
      speakerName,
      scheduledAt,
      links.zoom_link || null,
      links.youtube_link || null,
      links.calendar_link || null,
      links.question_link || null,
    ]
  );
  return result.rows[0];
}

export async function getUpcomingWebinars(championshipId: number): Promise<WebinarEvent[]> {
  const result = await pool.query<WebinarEvent>(
    `SELECT * FROM webinar_events
     WHERE championship_id = $1 AND scheduled_at > NOW()
     ORDER BY scheduled_at ASC`,
    [championshipId]
  );
  return result.rows;
}

export async function getWebinarsNeedingReminder(targetTime: Date): Promise<WebinarEvent[]> {
  const result = await pool.query<WebinarEvent>(
    `SELECT * FROM webinar_events
     WHERE scheduled_at > $1
       AND scheduled_at <= $1 + INTERVAL '1 minute'`,
    [targetTime]
  );
  return result.rows;
}

export async function getWebinarById(id: number): Promise<WebinarEvent | null> {
  const result = await pool.query<WebinarEvent>(
    'SELECT * FROM webinar_events WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}
