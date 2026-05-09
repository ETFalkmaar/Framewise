import { notFound } from 'next/navigation';
import {
  bookingsRepo,
  pagesRepo,
  subscriptionsRepo,
  tableCounts,
  tenantsRepo,
  usersRepo,
} from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default async function DebugDataPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [tenants, users, plans, bookings, counts] = await Promise.all([
    tenantsRepo.list(),
    usersRepo.list(),
    subscriptionsRepo.listPlans(),
    Promise.all((await tenantsRepo.list()).map((t) => bookingsRepo.listByTenant(t.id))).then(
      (arrs) => arrs.flat()
    ),
    tableCounts(),
  ]);

  const pages = (
    await Promise.all((await tenantsRepo.list()).map((t) => pagesRepo.listByTenant(t.id)))
  ).flat();

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-12 sm:px-8 lg:px-12">
      <header className="mb-12 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            /debug/data
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Developer-only · mock data preview
          </Badge>
        </div>
        <h1 className="text-display-lg font-bold tracking-tight">Mock data preview</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          In-memory store loaded from the JSON seed files. This route is hidden in production builds
          (returns 404) and never indexed.
        </p>
      </header>

      <section className="mb-16 space-y-6">
        <div>
          <h2 className="text-display-md font-semibold tracking-tight">Row counts</h2>
          <Separator className="mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(counts).map(([name, count]) => (
            <Card key={name} size="sm">
              <CardHeader>
                <CardTitle className="font-mono text-xs">{name}</CardTitle>
                <CardDescription className="text-foreground text-3xl font-semibold">
                  {count}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <PreviewSection
        title="Tenants"
        rows={tenants}
        emptyHint="Add seeds to mock/seeds/tenants.json"
      />
      <PreviewSection title="Users" rows={users} emptyHint="No users seeded" />
      <PreviewSection title="Subscription plans" rows={plans} emptyHint="No plans seeded" />
      <PreviewSection title="Pages" rows={pages} emptyHint="No pages seeded" />
      <PreviewSection title="Bookings" rows={bookings} emptyHint="No bookings seeded" />
    </main>
  );
}

function PreviewSection<T>({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: T[];
  emptyHint: string;
}) {
  return (
    <section className="mb-16 space-y-4">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">
          {title}{' '}
          <span className="text-muted-foreground text-base font-medium">({rows.length})</span>
        </h2>
        <Separator className="mt-3" />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      ) : (
        <pre className="bg-card text-card-foreground ring-border max-h-96 overflow-auto rounded-lg p-4 font-mono text-xs ring-1">
          {JSON.stringify(rows.slice(0, 3), null, 2)}
        </pre>
      )}
    </section>
  );
}
