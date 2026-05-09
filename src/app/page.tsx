export default function Home() {
  return (
    <main
      data-testid="homepage-hero"
      className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12 text-white"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          Framewise
        </h1>
        <p className="text-lg text-slate-300 sm:text-xl md:text-2xl">
          Smart websites, built right
        </p>
      </div>
      <footer className="mt-16 text-sm text-slate-500">Coming soon</footer>
    </main>
  );
}
