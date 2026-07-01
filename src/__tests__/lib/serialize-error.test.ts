import { describe, expect, it } from 'vitest';

import { serializeError } from '@/lib/serialize-error';

describe('serializeError', () => {
  it('captures name, message, and stack from a plain Error', () => {
    const result = serializeError(new Error('boom'));

    expect(result.name).toBe('Error');
    expect(result.message).toBe('boom');
    expect(typeof result.stack).toBe('string');
    expect(result.code).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('extracts a Supabase/PostgREST `code` off an Error subclass', () => {
    // Mirrors PostgrestError: extends Error, carries a string `code`.
    class PgError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = 'PostgrestError';
        this.code = code;
      }
    }

    const result = serializeError(new PgError('permission denied', '42501'));

    expect(result.code).toBe('42501');
    expect(result.message).toBe('permission denied');
    expect(result.name).toBe('PostgrestError');
  });

  it('extracts `status` (and falls back to `statusCode`) from storage-style errors', () => {
    class StatusError extends Error {
      status = 403;
    }
    class StatusCodeError extends Error {
      statusCode = 413;
    }

    expect(serializeError(new StatusError('denied')).status).toBe(403);
    expect(serializeError(new StatusCodeError('too large')).status).toBe(413);
  });

  it('reads message/code/status from a thrown plain object (non-Error)', () => {
    const result = serializeError({
      message: 'legacy shape',
      code: 'PGRST116',
      status: 406,
    });

    expect(result.message).toBe('legacy shape');
    expect(result.code).toBe('PGRST116');
    expect(result.status).toBe(406);
    // No stack on a non-Error value.
    expect(result.stack).toBeUndefined();
  });

  it('JSON-stringifies a plain object with no message field', () => {
    const result = serializeError({ foo: 'bar' });

    expect(result.message).toBe('{"foo":"bar"}');
  });

  it('never throws on a circular object', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = serializeError(circular);

    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('stringifies primitive throws', () => {
    expect(serializeError('just a string').message).toBe('just a string');
    expect(serializeError(null).message).toBe('null');
    expect(serializeError(undefined).message).toBe('undefined');
    expect(serializeError(42).message).toBe('42');
  });
});
