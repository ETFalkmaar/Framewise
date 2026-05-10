import type { ResolvedPage } from '@/lib/public-site/resolve-page';
import { renderBlock } from '@/lib/blocks/registry';

/**
 * Render a resolved public page — the same component is reused by
 * the path-prefix route (`/sites/<slug>(/<rest>)`) and the
 * subdomain/custom-domain catch-all so output is identical between
 * them. The route handlers do all the resolution + 404ing; this
 * component just walks the blocks.
 *
 * `data-testid="public-page"` plus per-block `data-testid` /
 * `data-block-position` attributes are wired so browser checks can
 * assert the rendering without snapshotting full HTML.
 */
export function PublicPageRenderer({ resolved }: { resolved: ResolvedPage }): React.JSX.Element {
  return (
    <main
      data-testid="public-page"
      data-tenant-slug={resolved.tenant.slug}
      data-page-slug={resolved.page.slug}
      className="bg-background text-foreground flex min-h-screen flex-col"
    >
      {resolved.blocks.length === 0 && (
        <section
          className="text-muted-foreground flex flex-1 items-center justify-center px-6 py-24 text-center"
          data-testid="public-page-empty"
        >
          <p>This page has no blocks yet.</p>
        </section>
      )}
      {resolved.blocks.map((block) => (
        <div
          key={block.id}
          data-testid={`block-${block.type}`}
          data-block-position={block.position}
        >
          {renderBlock(block, resolved.locale, resolved.defaultLocale)}
        </div>
      ))}
    </main>
  );
}
