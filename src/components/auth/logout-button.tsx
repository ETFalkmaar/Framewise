'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2Icon, LogOutIcon } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const t = useTranslations('account');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="logout-button"
      onClick={onClick}
      disabled={pending}
      className="gap-2"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <LogOutIcon className="size-4" />
      )}
      {t('logout')}
    </Button>
  );
}
