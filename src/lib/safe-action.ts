import 'server-only';

import type { User } from '@supabase/supabase-js';
import { ZodError, type ZodType } from 'zod';

import {
  actionError,
  actionSuccess,
  type ActionResponse,
} from '@/lib/action-response';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

type SafeActionContext = {
  user: User;
};

type SafeActionHandler<TInput, TOutput> = (
  input: TInput,
  ctx: SafeActionContext,
) => Promise<TOutput>;

type SafeActionOptions<TInput, TOutput> = {
  name: string;
  schema: ZodType<TInput>;
  handler: SafeActionHandler<TInput, TOutput>;
};

/**
 * Wraps a server action with auth checks, Zod validation, error handling,
 * and structured logging. All wrapped actions return an `ActionResponse<T>`
 * so the client can branch on `success` and show toasts uniformly.
 */
export function safeAction<TInput, TOutput>({
  name,
  schema,
  handler,
}: SafeActionOptions<TInput, TOutput>) {
  return async function action(
    rawInput: unknown,
  ): Promise<ActionResponse<TOutput>> {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== env.ADMIN_EMAIL) {
        logger.warn('safeAction: unauthorized', {
          action: name,
          userId: user?.id ?? null,
        });
        return actionError('Unauthorized');
      }

      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        const message = formatZodError(parsed.error);
        logger.info('safeAction: validation failed', {
          action: name,
          issues: parsed.error.issues,
        });
        return actionError(message);
      }

      const data = await handler(parsed.data, { user });
      logger.debug('safeAction: success', { action: name, userId: user.id });
      return actionSuccess(data);
    } catch (error) {
      logger.error('safeAction: unhandled error', {
        action: name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return actionError('Something went wrong. Please try again.');
    }
  };
}

function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Invalid input';
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}
