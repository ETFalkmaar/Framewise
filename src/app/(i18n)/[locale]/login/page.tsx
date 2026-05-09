import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type Locale } from '@/i18n/routing';

export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) {
    redirect('/account');
  }

  const t = await getTranslations('auth.login');

  return (
    <main
      data-testid="login-page"
      className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-6 py-24"
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Badge variant="outline" className="w-fit font-mono">
            /login
          </Badge>
          <CardTitle className="text-display-md mt-2">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
