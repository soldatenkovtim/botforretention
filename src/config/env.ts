import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  ADMIN_TELEGRAM_IDS: z.string().min(1),

  URL_CHAMPIONSHIPS: z.string().url(),
  URL_COMMUNITY: z.string().url(),
  URL_RULES: z.string().url(),
  URL_DASHBOARD: z.string().url(),
  URL_LEADERBOARD: z.string().url(),
  URL_ZIPLIME: z.string().url(),
  URL_TRADEAPI_DOCS: z.string().url(),
  URL_RESULTS: z.string().url(),
  URL_CAREERS: z.string().url(),
  URL_BUGBOUNTY: z.string().url(),
  URL_ZIPLIME_SUBMIT: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const adminIds = env.ADMIN_TELEGRAM_IDS.split(',').map((id) => parseInt(id.trim(), 10));
