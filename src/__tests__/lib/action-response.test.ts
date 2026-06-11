import { describe, expect, it } from 'vitest';

import { actionError, actionSuccess } from '@/lib/action-response';

describe('actionSuccess', () => {
  it('wraps data in a success response', () => {
    expect(actionSuccess({ id: 1 })).toEqual({
      success: true,
      data: { id: 1 },
    });
  });

  it('preserves primitive data', () => {
    expect(actionSuccess('ok')).toEqual({ success: true, data: 'ok' });
  });
});

describe('actionError', () => {
  it('wraps a message in an error response', () => {
    expect(actionError('Unauthorized')).toEqual({
      success: false,
      error: 'Unauthorized',
    });
  });
});
