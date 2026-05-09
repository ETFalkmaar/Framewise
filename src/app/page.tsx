import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main
      data-testid="homepage-hero"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground"
    >
      {/* Subtle gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <h1 className="text-display-xl sm:text-display-2xl font-bold tracking-tight">
          Framewise
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
          Smart websites, built right
        </p>
        <Button size="lg" className="mt-4" disabled>
          Coming soon
        </Button>
      </div>

      <footer className="relative z-10 mt-20 text-sm text-muted-foreground">
        Framewise · Multi-tenant website builder with AI agent
      </footer>
    </main>
  );
}
