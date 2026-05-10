import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCEPT_ALL,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_DENY,
  type ConsentRecord,
} from '../types';

import {
  clearConsent,
  getCurrentChoices,
  hasGivenConsent,
  readConsent,
  writeConsent,
} from '../storage';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const originalWindow = (globalThis as { window?: Window }).window;

function installWindow(): {
  window: Window & { localStorage: Storage };
  storage: MemoryStorage;
  events: string[];
} {
  const storage = new MemoryStorage();
  const events: string[] = [];
  const fakeWindow = {
    localStorage: storage,
    addEventListener: (type: string, listener: (event: Event) => void) => {
      // not used directly here, but kept for parity with browser API
      void type;
      void listener;
    },
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  } as unknown as Window & { localStorage: Storage };

  Object.defineProperty(globalThis, 'window', {
    value: fakeWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'Event', {
    value: class FakeEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
    configurable: true,
    writable: true,
  });
  return { window: fakeWindow, storage, events };
}

function removeWindow(): void {
  Object.defineProperty(globalThis, 'window', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (typeof originalWindow === 'undefined') {
    removeWindow();
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  }
  vi.useRealTimers();
});

describe('readConsent', () => {
  it('returns null when there is no window (SSR)', () => {
    removeWindow();
    expect(readConsent()).toBeNull();
  });

  it('returns null when nothing is stored yet', () => {
    installWindow();
    expect(readConsent()).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    const { storage } = installWindow();
    storage.setItem(CONSENT_STORAGE_KEY, 'this is not json {');
    expect(readConsent()).toBeNull();
  });

  it('returns null when the JSON has the wrong shape (missing fields)', () => {
    const { storage } = installWindow();
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(readConsent()).toBeNull();
  });

  it('returns null when necessary is not literally true', () => {
    const { storage } = installWindow();
    const record = {
      version: CONSENT_VERSION,
      choices: { necessary: false, analytics: true, marketing: false },
      timestamp: new Date().toISOString(),
    };
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    expect(readConsent()).toBeNull();
  });

  it('returns null when the version does not match CONSENT_VERSION', () => {
    const { storage } = installWindow();
    const record: ConsentRecord = {
      version: CONSENT_VERSION + 1,
      choices: ACCEPT_ALL,
      timestamp: new Date().toISOString(),
    };
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    expect(readConsent()).toBeNull();
  });

  it('returns null when the record is older than the TTL', () => {
    const { storage } = installWindow();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 366);
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      choices: ACCEPT_ALL,
      timestamp: oldDate.toISOString(),
    };
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    expect(readConsent()).toBeNull();
  });

  it('returns the record when fresh and well-formed', () => {
    const { storage } = installWindow();
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      choices: ACCEPT_ALL,
      timestamp: new Date().toISOString(),
    };
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    expect(readConsent()?.choices).toEqual(ACCEPT_ALL);
  });
});

describe('writeConsent', () => {
  it('persists a fresh record to localStorage', () => {
    const { storage } = installWindow();
    writeConsent(ACCEPT_ALL);
    const stored = JSON.parse(storage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.choices).toEqual(ACCEPT_ALL);
    expect(stored.version).toBe(CONSENT_VERSION);
    expect(typeof stored.timestamp).toBe('string');
  });

  it('forces necessary to true even if a caller tries to disable it', () => {
    const { storage } = installWindow();
    writeConsent({
      ...ACCEPT_ALL,
      necessary: false as unknown as true,
    });
    const stored = JSON.parse(storage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.choices.necessary).toBe(true);
  });

  it('dispatches a CONSENT_CHANGED_EVENT', () => {
    const { events } = installWindow();
    writeConsent(ACCEPT_ALL);
    expect(events).toContain(CONSENT_CHANGED_EVENT);
  });

  it('returns a record even when there is no window (SSR)', () => {
    removeWindow();
    const record = writeConsent(ACCEPT_ALL);
    expect(record.choices).toEqual(ACCEPT_ALL);
    expect(record.version).toBe(CONSENT_VERSION);
  });

  it('round-trips: writeConsent then readConsent gives the same choices', () => {
    installWindow();
    writeConsent({
      necessary: true,
      analytics: true,
      marketing: false,
    });
    expect(readConsent()?.choices).toEqual({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });
});

describe('clearConsent', () => {
  it('removes the stored record', () => {
    const { storage } = installWindow();
    writeConsent(ACCEPT_ALL);
    expect(storage.getItem(CONSENT_STORAGE_KEY)).not.toBeNull();
    clearConsent();
    expect(storage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('dispatches a CONSENT_CHANGED_EVENT', () => {
    const { events } = installWindow();
    writeConsent(ACCEPT_ALL);
    events.length = 0;
    clearConsent();
    expect(events).toContain(CONSENT_CHANGED_EVENT);
  });

  it('is a noop in SSR', () => {
    removeWindow();
    expect(() => clearConsent()).not.toThrow();
  });
});

describe('hasGivenConsent', () => {
  it('returns false when no consent is stored', () => {
    installWindow();
    expect(hasGivenConsent()).toBe(false);
  });

  it('returns true after writeConsent', () => {
    installWindow();
    writeConsent(DEFAULT_DENY);
    expect(hasGivenConsent()).toBe(true);
  });
});

describe('getCurrentChoices', () => {
  it('returns DEFAULT_DENY when nothing is stored', () => {
    installWindow();
    expect(getCurrentChoices()).toEqual(DEFAULT_DENY);
  });

  it('returns the stored choices after writeConsent', () => {
    installWindow();
    writeConsent({
      necessary: true,
      analytics: true,
      marketing: false,
    });
    expect(getCurrentChoices()).toEqual({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });
});
