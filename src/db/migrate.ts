import { pool } from './pool';

const migration = `
CREATE TABLE IF NOT EXISTS championships (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  launch_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  prize_pool VARCHAR(100) NOT NULL DEFAULT '300 000 ₽',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  championship_id INTEGER REFERENCES championships(id),
  league VARCHAR(20) CHECK (league IN ('algo', 'manual')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state VARCHAR(20) NOT NULL DEFAULT 'pre_launch' CHECK (state IN ('pre_launch', 'active', 'finished')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS triggers (
  id SERIAL PRIMARY KEY,
  trigger_key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  scheduled_at TIMESTAMPTZ,
  championship_id INTEGER NOT NULL REFERENCES championships(id),
  fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webinar_events (
  id SERIAL PRIMARY KEY,
  championship_id INTEGER NOT NULL REFERENCES championships(id),
  title VARCHAR(500) NOT NULL,
  speaker_name VARCHAR(255) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  zoom_link VARCHAR(500),
  youtube_link VARCHAR(500),
  calendar_link VARCHAR(500),
  question_link VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sent_messages (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
  trigger_key VARCHAR(100) NOT NULL,
  championship_id INTEGER REFERENCES championships(id),
  webinar_id INTEGER REFERENCES webinar_events(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(telegram_id, trigger_key, championship_id, webinar_id)
);

ALTER TABLE sent_messages ALTER COLUMN championship_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_triggers_scheduled ON triggers(scheduled_at) WHERE fired_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sent_messages_lookup ON sent_messages(telegram_id, trigger_key, championship_id);
CREATE INDEX IF NOT EXISTS idx_users_championship ON users(championship_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webinar_events_scheduled ON webinar_events(scheduled_at);
`;

async function migrate() {
  console.log('Running migrations...');
  await pool.query(migration);
  console.log('✅ Migrations completed successfully');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
