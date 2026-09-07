import { describe, expect, it } from 'vitest';
import { isFieldArea } from './fieldArea';

describe('isFieldArea', () => {
  it('recognizes TAG and TRANSPORTE case-insensitively', () => {
    expect(isFieldArea('TAG')).toBe(true);
    expect(isFieldArea('tag')).toBe(true);
    expect(isFieldArea('TRANSPORTE')).toBe(true);
    expect(isFieldArea('transporte')).toBe(true);
  });

  it('rejects staff / empty areas', () => {
    expect(isFieldArea(null)).toBe(false);
    expect(isFieldArea(undefined)).toBe(false);
    expect(isFieldArea('OPERACIONES')).toBe(false);
    expect(isFieldArea('')).toBe(false);
  });
});
