'use client';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type ColorSwatch = {
  name: string;
  cssVar: string;
  hex: string;
  fg?: string;
};

const colorSwatches: ColorSwatch[] = [
  { name: 'background', cssVar: 'bg-background', hex: '#0A0E1A', fg: 'text-foreground' },
  { name: 'foreground', cssVar: 'bg-foreground', hex: '#F8FAFC', fg: 'text-background' },
  { name: 'primary', cssVar: 'bg-primary', hex: '#3B82F6', fg: 'text-primary-foreground' },
  { name: 'secondary', cssVar: 'bg-secondary', hex: '#1E293B', fg: 'text-secondary-foreground' },
  { name: 'accent', cssVar: 'bg-accent', hex: '#06B6D4', fg: 'text-accent-foreground' },
  { name: 'muted', cssVar: 'bg-muted', hex: '#334155', fg: 'text-muted-foreground' },
  {
    name: 'destructive',
    cssVar: 'bg-destructive',
    hex: '#EF4444',
    fg: 'text-destructive-foreground',
  },
  { name: 'success', cssVar: 'bg-success', hex: '#10B981', fg: 'text-success-foreground' },
  { name: 'warning', cssVar: 'bg-warning', hex: '#F59E0B', fg: 'text-warning-foreground' },
  { name: 'border', cssVar: 'bg-border', hex: '#1E293B', fg: 'text-foreground' },
];

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={testId} className="space-y-6">
      <div>
        <h2 className="text-display-md font-semibold tracking-tight">{title}</h2>
        <Separator className="mt-3" />
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-12 sm:px-8 lg:px-12">
      <header className="mb-16 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            /design-system
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Developer-only · no translations
          </Badge>
        </div>
        <h1 className="text-display-xl font-bold tracking-tight">Framewise Design System</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Tokens, typografie en componenten van het Framewise platform. Deze pagina is bedoeld voor
          ontwikkelaars en valt buiten de meertalige routing — er is bewust geen vertaling van.
        </p>
      </header>

      <div className="space-y-20">
        {/* Colors */}
        <Section title="Colors" testId="ds-colors">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {colorSwatches.map((swatch) => (
              <div key={swatch.name} className="space-y-2">
                <div
                  className={`ring-border flex h-20 w-full items-end justify-start rounded-lg ring-1 ${swatch.cssVar} ${swatch.fg ?? ''} p-2`}
                >
                  <span className="font-mono text-[0.65rem] opacity-80">{swatch.hex}</span>
                </div>
                <p className="text-sm font-medium">{swatch.name}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography" testId="ds-typography">
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">
                display-2xl · 4.5rem / 1.1 / -0.02em
              </p>
              <p className="text-display-2xl font-bold tracking-tight">Framewise</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">
                display-xl · 3.75rem / 1.1 / -0.02em
              </p>
              <p className="text-display-xl font-bold tracking-tight">Smart websites</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">
                display-lg · 3rem / 1.15 / -0.015em
              </p>
              <p className="text-display-lg font-bold tracking-tight">Built right</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">
                display-md · 2.25rem / 1.2 / -0.01em
              </p>
              <p className="text-display-md font-semibold tracking-tight">Section heading</p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">h1 · text-3xl</p>
              <h1 className="text-3xl font-semibold tracking-tight">Heading level 1</h1>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">h2 · text-2xl</p>
              <h2 className="text-2xl font-semibold tracking-tight">Heading level 2</h2>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">h3 · text-xl</p>
              <h3 className="text-xl font-medium">Heading level 3</h3>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">paragraph · text-base</p>
              <p className="max-w-prose">
                Framewise combineert moderne webtechnologie met een geïntegreerde AI-agent om
                bedrijfssites razendsnel op te leveren — meertalig, multi-tenant en uit één
                codebase.
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">small · text-sm</p>
              <p className="text-sm">
                Een kleine typografische component voor secundaire informatie.
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">
                muted · text-sm text-muted-foreground
              </p>
              <p className="text-muted-foreground text-sm">Voor metadata, hints en bijschriften.</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 font-mono text-xs">mono · font-mono</p>
              <p className="font-mono text-sm">const framewise = &quot;built right&quot;;</p>
            </div>
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons" testId="ds-buttons">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm font-medium">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm font-medium">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">xs</Button>
                <Button size="sm">sm</Button>
                <Button size="default">default</Button>
                <Button size="lg">lg</Button>
                <Button size="icon" aria-label="icon">
                  *
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm font-medium">States</p>
              <div className="flex flex-wrap gap-3">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>
                  Disabled outline
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs" testId="ds-inputs">
          <div className="grid max-w-xl gap-6">
            <div className="space-y-2">
              <Label htmlFor="ds-email">E-mail</Label>
              <Input id="ds-email" type="email" placeholder="you@framewise.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-name">Naam</Label>
              <Input id="ds-name" placeholder="Voer je naam in" defaultValue="Framewise" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" placeholder="Niet beschikbaar" disabled />
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards" testId="ds-cards">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI-agent</CardTitle>
                <CardDescription>
                  Genereer content, vertalingen en SEO-titels in seconden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  De ingebouwde agent helpt je om hele pagina&apos;s te bouwen uit een korte
                  beschrijving en houdt rekening met je tone of voice.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Meer info
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Multi-tenant</CardTitle>
                <CardDescription>Eén codebase, oneindig veel sites.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Beheer al je sites vanuit één dashboard. Each tenant heeft een eigen domein, taal
                  en huisstijl.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Demo</Button>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" testId="ds-badges">
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>
        </Section>

        {/* Tabs */}
        <Section title="Tabs" testId="ds-tabs">
          <Tabs defaultValue="overview" className="w-full max-w-2xl">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="docs">Docs</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              <p className="text-muted-foreground text-sm">
                Framewise combineert moderne webtechnologie met een AI-agent om sites razendsnel op
                te leveren.
              </p>
            </TabsContent>
            <TabsContent value="features" className="pt-4">
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                <li>Multi-tenant met aparte domeinen per site</li>
                <li>Meertalig via next-intl</li>
                <li>Server components en streaming uit de doos</li>
              </ul>
            </TabsContent>
            <TabsContent value="docs" className="pt-4">
              <p className="text-muted-foreground text-sm">
                Documentatie volgt zodra de eerste publieke release klaarstaat.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* Dialog */}
        <Section title="Dialog" testId="ds-dialog">
          <Dialog>
            <DialogTrigger render={<Button data-testid="ds-dialog-trigger">Open dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Welkom bij Framewise</DialogTitle>
                <DialogDescription>
                  Dit is een voorbeelddialoog die het design system demonstreert. Sluit met Escape
                  of de knop hieronder.
                </DialogDescription>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                Dialogen gebruiken het popover-token, scherm-overlap en animatie uit het design
                system.
              </p>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Sluiten</Button>} />
                <DialogClose render={<Button>Begrepen</Button>} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        {/* Toast */}
        <Section title="Toast" testId="ds-toast">
          <div className="flex flex-wrap gap-3">
            <Button
              data-testid="ds-toast-trigger"
              onClick={() =>
                toast.success('Framewise design tokens geladen', {
                  description: 'Inter + JetBrains Mono, electric blue accent.',
                })
              }
            >
              Toon toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning('Voorbeeld waarschuwing', {
                  description: 'Dit is een demo voor de warning-state.',
                })
              }
            >
              Warning
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                toast.error('Voorbeeld error', {
                  description: 'Iets ging mis in deze demo.',
                })
              }
            >
              Error
            </Button>
          </div>
        </Section>
      </div>
    </main>
  );
}
