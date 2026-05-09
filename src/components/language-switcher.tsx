'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronDownIcon, GlobeIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { localeFlags, localeNames, locales, type Locale } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations('languageSwitcher');

  return (
    <div data-testid="language-switcher">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label={t('selectLanguage')}
              className="gap-2"
            />
          }
        >
          <GlobeIcon className="size-4" />
          <span aria-hidden>{localeFlags[currentLocale]}</span>
          <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
          <ChevronDownIcon className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {t('selectLanguage')}
          </div>
          <DropdownMenuSeparator />
          {locales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              data-active={locale === currentLocale}
              data-testid={`language-option-${locale}`}
              render={
                <Link href={pathname} locale={locale} className="flex w-full items-center gap-2" />
              }
            >
              <span aria-hidden>{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
              {locale === currentLocale && (
                <span className="text-muted-foreground ml-auto text-xs">●</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
