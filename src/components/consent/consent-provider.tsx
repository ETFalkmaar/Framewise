'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  ACCEPT_ALL,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  DEFAULT_DENY,
  type ConsentChoices,
  type ConsentRecord,
  readConsent,
  writeConsent,
} from '@/lib/consent';

interface ConsentContextValue {
  /** Current choices, defaults to `DEFAULT_DENY` until the user opts in. */
  choices: ConsentChoices;
  /** `true` iff a valid consent record exists in localStorage. */
  hasConsented: boolean;
  /** Persist choices and dismiss the banner / modal. */
  setChoices: (choices: ConsentChoices) => void;
  /** Whether the bottom banner should be visible right now. */
  showBanner: boolean;
  /** Whether the granular preferences modal should be visible. */
  showModal: boolean;
  /** Open the modal — used by the footer link and the banner's "Customise" button. */
  openModal: () => void;
  /** Close the modal without saving. */
  closeModal: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/**
 * Subscribe to localStorage + custom-event changes. The provider
 * uses `useSyncExternalStore` so the consent state is read directly
 * from `localStorage` instead of being mirrored into React state —
 * no `setState` in effects, no SSR hydration mismatches.
 */
function subscribeToConsent(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) {
      invalidateSnapshotCache();
      callback();
    }
  };
  const handleChange = () => {
    invalidateSnapshotCache();
    callback();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(CONSENT_CHANGED_EVENT, handleChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CONSENT_CHANGED_EVENT, handleChange);
  };
}

/**
 * `useSyncExternalStore` requires that `getSnapshot()` returns the
 * same reference when nothing has changed. `readConsent()` parses
 * JSON on every call, so we memoise its result against the raw
 * string and only re-read when invalidated by an event.
 */
let snapshotCacheRaw: string | null | undefined = undefined;
let snapshotCacheValue: ConsentRecord | null = null;

function invalidateSnapshotCache(): void {
  snapshotCacheRaw = undefined;
}

function readSnapshot(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === snapshotCacheRaw) return snapshotCacheValue;
  snapshotCacheRaw = raw;
  snapshotCacheValue = readConsent();
  return snapshotCacheValue;
}

function readServerSnapshot(): ConsentRecord | null {
  return null;
}

/**
 * Wraps the public site so any component can read the visitor's
 * cookie choices and trigger the banner / modal. SSR-safe via
 * `useSyncExternalStore` — server snapshot is `null` (no consent
 * yet), so banner/modal stay hidden until the client hydrates.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const record = useSyncExternalStore(subscribeToConsent, readSnapshot, readServerSnapshot);
  const [showModal, setShowModal] = useState(false);

  const choices = record?.choices ?? DEFAULT_DENY;
  const hasConsented = record !== null;
  const showBanner = !hasConsented;

  const setChoices = useCallback((newChoices: ConsentChoices) => {
    writeConsent(newChoices);
    setShowModal(false);
  }, []);

  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      choices,
      hasConsented,
      setChoices,
      showBanner,
      showModal,
      openModal,
      closeModal,
    }),
    [choices, hasConsented, setChoices, showBanner, showModal, openModal, closeModal]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return ctx;
}

export { ACCEPT_ALL, DEFAULT_DENY };
