import { UserProfile, type AuthUser } from '@/types';

type ProfileSource = Pick<AuthUser, 'profile' | 'area'> | Partial<Pick<AuthUser, 'profile' | 'area'>>;

/**
 * The user's access profile. Sessions stored before profiles existed have no
 * `profile`; for those the backend still reported field users as area TAG/TRANSPORTE.
 */
export function getUserProfile(user: ProfileSource | null | undefined): UserProfile | null {
  if (!user) return null;
  if (user.profile) return user.profile;
  const legacy = user.area?.trim().toUpperCase();
  if (legacy === UserProfile.TAG) return UserProfile.TAG;
  if (legacy === UserProfile.TRANSPORTE) return UserProfile.TRANSPORTE;
  return UserProfile.STAFF;
}

export function isFieldUser(user: ProfileSource | null | undefined): boolean {
  const profile = getUserProfile(user);
  return profile === UserProfile.TAG || profile === UserProfile.TRANSPORTE;
}

export function isTransportUser(user: ProfileSource | null | undefined): boolean {
  return getUserProfile(user) === UserProfile.TRANSPORTE;
}
