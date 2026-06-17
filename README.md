# Finam Collab Championship Bot

Telegram notification bot for the Finam Collab trading championship platform. Sends automated, trigger-based messages to participants throughout the 8-week championship lifecycle.

## Features

- Automated trigger-based notifications (pre-launch, weekly updates, webinar reminders)
- Admin panel for managing championships, webinars, and manual triggers
- Rate-limited message queue (BullMQ + Redis)
- Idempotent message delivery (no duplicate sends)
- Graceful handling of blocked users
- Timezone-aware scheduling (Europe/Moscow)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Setup

```bash
# Clone and enter the project
cd botforretention

# Copy environment file and fill in your values
cp .env.example .env

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec bot node dist/db/migrate.js

# (Optional) Seed sample data
docker-compose exec bot node dist/db/seed.js
```

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis (via Docker)
docker-compose up postgres redis -d

# Set up env
cp .env.example .env
# Edit .env with your BOT_TOKEN and local DB/Redis URLs

# Run migrations
npm run migrate

# Start in dev mode (hot reload)
npm run dev
```

## Architecture

```
src/
  bot/
    commands/         # /start, /help, /status, /leaderboard
    admin/            # Admin commands & wizard
  triggers/
    triggerService.ts # Core trigger dispatch logic
    templates/        # Message templates with inline keyboards
  scheduler/
    cron.ts           # Cron jobs checking for due triggers
  queue/
    messageQueue.ts   # BullMQ rate-limited send queue
  db/
    models/           # User, Championship, Trigger, WebinarEvent, SentMessage
    migrate.ts        # Database migrations
    seed.ts           # Sample data seeder
    pool.ts           # PostgreSQL connection pool
  config/
    env.ts            # Validated environment config
  index.ts            # Entry point
```

## Trigger System

| ID | Key | When |
|----|-----|------|
| 0 | `launch_bot` | On /start command |
| 3 | `pre_launch_3d` | 3 days before launch, 10:00 MSK |
| 4 | `pre_launch_1d` | 1 day before launch, 10:00 MSK |
| 5 | `pre_launch_start` | Launch day, 11:00 MSK |
| 6 | `weekly_leaderboard_update` | Every Monday 10:00 MSK |
| 7 | `webinar_reminder_24h` | 24h before each webinar |
| 8 | `mid_champ_early_selection` | Week 4, 10:00 MSK |
| 10 | `champ_closed_results` | Manual admin trigger |

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register and get welcome message |
| `/status` | View championship status |
| `/leaderboard` | Quick link to leaderboard |
| `/help` | Show available commands |

## Admin Commands

All admin commands require the user's Telegram ID to be in `ADMIN_TELEGRAM_IDS`.

| Command | Description |
|---------|-------------|
| `/admin fire_trigger <key> <champ_id>` | Manually fire a trigger |
| `/admin add_championship` | Interactive wizard to create championship |
| `/admin add_webinar` | Interactive wizard to add webinar |
| `/admin broadcast <message>` | Broadcast to all active users |

## Environment Variables

See `.env.example` for the full list of required variables.
