import { describe, expect, it } from 'vitest';
import { loginDestination } from './loginRedirect';

describe('loginDestination', () => {
  it('goes back to the page that asked for login', () => {
    expect(loginDestination({ from: '/logistica/combustible/load-1/foto/ticket' }))
      .toBe('/logistica/combustible/load-1/foto/ticket');
    expect(loginDestination({ from: '/ocr/remitos?page=2' })).toBe('/ocr/remitos?page=2');
  });

  it('falls back to home for anything that is not an in-app path', () => {
    expect(loginDestination(null)).toBe('/');
    expect(loginDestination({})).toBe('/');
    expect(loginDestination({ from: 'https://evil.test' })).toBe('/');
    expect(loginDestination({ from: '//evil.test/x' })).toBe('/');
    expect(loginDestination({ from: '/\\evil.test/x' })).toBe('/');
    expect(loginDestination({ from: '/login' })).toBe('/');
  });
});
