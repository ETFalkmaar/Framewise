import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '@/lib/data';
import { verifyCredentials } from '@/lib/auth';

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

describe('verifyCredentials', () => {
  it('returns the user on a correct email + password match', async () => {
    const user = await verifyCredentials('framewise@example.com', 'Framewise2025!');
    expect(user).not.toBeNull();
    expect(user?.email).toBe('framewise@example.com');
  });

  it('returns null on wrong password', async () => {
    expect(await verifyCredentials('framewise@example.com', 'wrong-password')).toBeNull();
  });

  it('returns null on unknown email', async () => {
    expect(await verifyCredentials('ghost@example.com', 'anything')).toBeNull();
  });

  it('is case insensitive on email', async () => {
    const user = await verifyCredentials('FRAMEWISE@example.COM', 'Framewise2025!');
    expect(user?.id).toBe('a0000000-0000-0000-0000-000000000001');
  });

  it('returns null on empty email or password', async () => {
    expect(await verifyCredentials('', 'Framewise2025!')).toBeNull();
    expect(await verifyCredentials('framewise@example.com', '')).toBeNull();
  });

  it('verifies the villa-owner credentials', async () => {
    const user = await verifyCredentials('owner@demo-villa.example', 'Villa2025!');
    expect(user?.name).toBe('Villa Owner');
  });

  it('verifies the restaurant-owner credentials', async () => {
    const user = await verifyCredentials('owner@demo-restaurant.example', 'Restaurant2025!');
    expect(user?.name).toBe('Restaurant Owner');
  });
});
