'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        toast.error(t('error'));
        setSubmitting(false);
        return;
      }
      router.push('/account');
      router.refresh();
    } catch {
      toast.error(t('error'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} data-testid="login-form" className="flex flex-col gap-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">{t('email')}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t('password')}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </div>
      <Button type="submit" className="mt-2 gap-2" disabled={submitting}>
        {submitting && <Loader2Icon className="size-4 animate-spin" />}
        {submitting ? t('loading') : t('submit')}
      </Button>
    </form>
  );
}
