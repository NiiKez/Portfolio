import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('merges conflicting tailwind utilities, keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('supports arrays and objects via clsx', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });
});
