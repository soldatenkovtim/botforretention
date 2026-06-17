import { Context, MiddlewareFn } from 'telegraf';
import { adminIds } from '../../config/env';

export const adminOnly: MiddlewareFn<Context> = (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || !adminIds.includes(userId)) {
    return;
  }
  return next();
};
