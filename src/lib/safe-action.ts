import 'server-only';

import type { User } from '@supabase/supabase-js';
import { ZodError, type ZodType } from 'zod';

import {
  actionError,
  actionSuccess,
  type ActionResponse,
} from '@/lib/action-response';
import { isAdminEmail } from '@/lib/admin-email';
import { logger } from '@/lib/logger';
import { serializeError } from '@/lib/serialize-error';
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
    // Hoisted so the catch can attribute an unhandled error to the caller.
    let user: User | null = null;
    try {
      const supabase = await createClient();
      ({
        data: { user },
      } = await supabase.auth.getUser());

      if (!user || !isAdminEmail(user.email)) {
        logger.warn('safeAction: unauthorized', {
          action: name,
          userId: user?.id ?? null,
        });
        return actionError('Unauthorized');
      }

      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        const message = formatZodError(parsed.error);
        // Log only path + code, never the raw issue objects — a future custom
        // refine message or `unrecognized_keys` issue could otherwise echo the
        // submitted value/key into the logs.
        logger.info('safeAction: validation failed', {
          action: name,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
          })),
        });
        return actionError(message);
      }

      const data = await handler(parsed.data, { user });
      logger.debug('safeAction: success', { action: name, userId: user.id });
      return actionSuccess(data);
    } catch (error) {
      logger.error('safeAction: unhandled error', {
        action: name,
        userId: user?.id ?? null,
        err: serializeError(error),
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
