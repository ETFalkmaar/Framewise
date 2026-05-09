import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['nl', 'fr', 'en'],
  defaultLocale: 'nl',
  localePrefix: 'as-needed',
});

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  nl: 'Nederlands',
  fr: 'Français',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  nl: '🇳🇱',
  fr: '🇫🇷',
  en: '🇬🇧',
};
