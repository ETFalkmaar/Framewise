import type { LocaleCode, Tenant } from '@/types/database';

/**
 * Branded maintenance helpers (step 34, fase 10).
 *
 * `resolveMaintenanceMessage` walks the locale fallback chain so a
 * tenant that only filled in NL still gets something readable for
 * an EN visitor:
 *
 *   1. `tenant.maintenance_message_translations[locale]`
 *   2. `tenant.maintenance_message_translations[tenant.default_locale]`
 *   3. any other filled-in locale (deterministic via key sort)
 *   4. the framework default
 *
 * Empty strings inside the map are treated as missing so a half-
 * filled translation row can still fall through to a real message.
 */
const DEFAULT_MESSAGE: Record<LocaleCode, string> = {
  nl: 'Deze site wordt momenteel bijgewerkt. Probeer het later opnieuw.',
  fr: 'Ce site est en cours de mise à jour. Réessayez plus tard.',
  en: 'This site is currently being updated. Please check back shortly.',
};

const DEFAULT_HEADLINE: Record<LocaleCode, string> = {
  nl: 'Site in onderhoud',
  fr: 'Site en maintenance',
  en: 'Site under maintenance',
};

export function resolveMaintenanceMessage(tenant: Tenant, locale: LocaleCode): string {
  const messages = tenant.maintenance_message_translations;
  if (messages) {
    const direct = messages[locale];
    if (typeof direct === 'string' && direct.length > 0) return direct;

    const fallback = messages[tenant.default_locale];
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;

    const keys = Object.keys(messages).sort() as LocaleCode[];
    for (const key of keys) {
      const value = messages[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }
  return DEFAULT_MESSAGE[locale];
}

export function resolveMaintenanceHeadline(locale: LocaleCode): string {
  return DEFAULT_HEADLINE[locale];
}

/**
 * `true` iff the tenant has any branding to show on the page
 * (logo, custom message, contact email). Used to decide whether
 * to render the Framewise default frame vs the full branded
 * frame.
 */
export function hasMaintenanceBranding(tenant: Tenant): boolean {
  return Boolean(
    tenant.maintenance_logo_url ||
    tenant.maintenance_contact_email ||
    (tenant.maintenance_message_translations &&
      Object.values(tenant.maintenance_message_translations).some(
        (v) => typeof v === 'string' && v.length > 0
      ))
  );
}
