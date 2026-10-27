import { describe, expect, it } from 'vitest';
import { UserProfile } from '@/types';
import { getUserProfile, isFieldUser, isTransportUser } from './profile';

describe('getUserProfile', () => {
  it('uses the profile sent by the backend', () => {
    expect(getUserProfile({ profile: UserProfile.TAG, area: null })).toBe(UserProfile.TAG);
    expect(getUserProfile({ profile: UserProfile.STAFF, area: 'Logística' })).toBe(UserProfile.STAFF);
  });

  it('does not treat a staff area named TAG as a field user', () => {
    expect(getUserProfile({ profile: UserProfile.STAFF, area: 'TAG' })).toBe(UserProfile.STAFF);
  });

  it('falls back to the area for sessions stored before profiles existed', () => {
    expect(getUserProfile({ area: 'tag' })).toBe(UserProfile.TAG);
    expect(getUserProfile({ area: 'Transporte' })).toBe(UserProfile.TRANSPORTE);
    expect(getUserProfile({ area: 'OPERACIONES' })).toBe(UserProfile.STAFF);
    expect(getUserProfile({ area: null })).toBe(UserProfile.STAFF);
  });

  it('returns null without a user', () => {
    expect(getUserProfile(null)).toBeNull();
    expect(getUserProfile(undefined)).toBeNull();
  });
});

describe('isFieldUser / isTransportUser', () => {
  it('recognizes field profiles', () => {
    expect(isFieldUser({ profile: UserProfile.TAG })).toBe(true);
    expect(isFieldUser({ profile: UserProfile.TRANSPORTE })).toBe(true);
    expect(isFieldUser({ profile: UserProfile.STAFF })).toBe(false);
    expect(isFieldUser(null)).toBe(false);
    expect(isTransportUser({ profile: UserProfile.TRANSPORTE })).toBe(true);
    expect(isTransportUser({ profile: UserProfile.TAG })).toBe(false);
  });
});
