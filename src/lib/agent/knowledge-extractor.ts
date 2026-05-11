import { blocksRepo, pagesRepo } from '@/lib/data';
import type { AgentLanguage, Block, KnowledgeBaseDocument, Page } from '@/types/database';

/**
 * Knowledge-base content extractor (step 58, fase 15 part 3/9).
 *
 * Turns the tenant's published page content into plain-text snippets
 * the agent can retrieve from. The block data shapes vary per type —
 * the real seeds use `headline_translations` + `subheadline_translations`
 * etc. so the extractor falls back to whichever locale has content
 * (primary → nl → en → anything).
 *
 * Image / cta / gallery blocks contribute no text. FAQ items become
 * "Vraag/Antwoord" pairs so the retrieval layer can match question
 * substrings without losing the answer mapping.
 */

type TranslationMap = Partial<Record<AgentLanguage, string>> & {
  [key: string]: string | undefined;
};

interface FaqItemData {
  question?: string;
  answer?: string;
  question_translations?: TranslationMap;
  answer_translations?: TranslationMap;
}

interface PricingPlanData {
  id?: string;
  name?: string;
  price?: string;
  description?: string;
  name_translations?: TranslationMap;
  description_translations?: TranslationMap;
  features_translations?: TranslationMap[];
}

interface BlockData {
  // Hero / CTA / Section headers
  title?: string;
  subtitle?: string;
  description?: string;
  headline?: string;
  subheadline?: string;
  title_translations?: TranslationMap;
  subtitle_translations?: TranslationMap;
  description_translations?: TranslationMap;
  headline_translations?: TranslationMap;
  subheadline_translations?: TranslationMap;
  cta_text?: string;
  cta_text_translations?: TranslationMap;
  button_text_translations?: TranslationMap;
  // Text body
  content?: string;
  content_translations?: TranslationMap;
  // FAQ
  items?: FaqItemData[];
  // Pricing
  plans?: PricingPlanData[];
  // Contact
  email?: string;
  phone?: string;
  address?: string;
  recipient_email?: string;
}

/**
 * Remove HTML tags + normalise whitespace. `<br>` and `</p>` become
 * newlines so the agent sees paragraph breaks; everything else is
 * collapsed.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Resolve a translation map down to a single string, preferring the
 * primary locale, then nl, then en, then anything else. Returns ''
 * when the map is empty.
 */
function pickTranslation(map: TranslationMap | undefined, primary: AgentLanguage): string {
  if (!map) return '';
  if (map[primary]) return map[primary]!;
  if (map.nl) return map.nl;
  if (map.en) return map.en;
  for (const v of Object.values(map)) {
    if (v) return v;
  }
  return '';
}

/**
 * Walk a page's blocks and turn them into plain-text knowledge.
 * Skips blocks with no textual content. The returned string is what
 * gets pushed into ElevenLabs' KB document for that page.
 */
export function extractFromPageBlocks(
  blocks: Block[],
  primaryLocale: AgentLanguage = 'nl'
): string {
  const parts: string[] = [];
  // Stable order even when the caller didn't pre-sort.
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);

  for (const block of sorted) {
    const d = block.data as BlockData;
    switch (block.block_type) {
      case 'hero': {
        // Seed hero blocks use `headline_translations`; the spec
        // referenced `title`/`subtitle`. Support both. We use `||`
        // rather than `??` because `pickTranslation` returns `''`
        // (truthy-falsy) when no translation is available — `??`
        // would stop at the empty string instead of trying the next
        // candidate.
        const headline =
          d.title ||
          pickTranslation(d.title_translations, primaryLocale) ||
          pickTranslation(d.headline_translations, primaryLocale);
        const sub =
          d.subtitle ||
          pickTranslation(d.subtitle_translations, primaryLocale) ||
          pickTranslation(d.subheadline_translations, primaryLocale);
        const desc = d.description || pickTranslation(d.description_translations, primaryLocale);
        if (headline) parts.push(headline);
        if (sub) parts.push(sub);
        if (desc) parts.push(stripHtml(desc));
        break;
      }
      case 'text': {
        const body = d.content || pickTranslation(d.content_translations, primaryLocale);
        if (body) parts.push(stripHtml(body));
        break;
      }
      case 'cta': {
        // CTAs are nav, not knowledge — but the headline often
        // contains a useful "Ready to book?" signal worth indexing.
        const headline = pickTranslation(d.headline_translations, primaryLocale) || d.title;
        if (headline) parts.push(headline);
        break;
      }
      case 'faq': {
        const items = d.items ?? [];
        for (const item of items) {
          const q = item.question || pickTranslation(item.question_translations, primaryLocale);
          const a = item.answer || pickTranslation(item.answer_translations, primaryLocale);
          if (q) parts.push(`Vraag: ${q}`);
          if (a) parts.push(`Antwoord: ${stripHtml(a)}`);
        }
        break;
      }
      case 'pricing': {
        const intro = pickTranslation(d.headline_translations, primaryLocale) || d.title;
        if (intro) parts.push(intro);
        const sub = pickTranslation(d.subheadline_translations, primaryLocale);
        if (sub) parts.push(sub);
        const plans = d.plans ?? [];
        for (const plan of plans) {
          const name = plan.name || pickTranslation(plan.name_translations, primaryLocale);
          const desc =
            plan.description || pickTranslation(plan.description_translations, primaryLocale);
          const planParts: string[] = [];
          if (name) planParts.push(name);
          if (plan.price) planParts.push(plan.price);
          if (desc) planParts.push(stripHtml(desc));
          // Flatten features list — seeds expose it as an array of
          // translation maps.
          if (Array.isArray(plan.features_translations)) {
            for (const featureMap of plan.features_translations) {
              const f = pickTranslation(featureMap, primaryLocale);
              if (f) planParts.push(`• ${f}`);
            }
          }
          if (planParts.length > 0) parts.push(planParts.join(': '));
        }
        break;
      }
      case 'contact': {
        if (d.email) parts.push(`Email: ${d.email}`);
        if (d.recipient_email && d.recipient_email !== d.email) {
          parts.push(`Email: ${d.recipient_email}`);
        }
        if (d.phone) parts.push(`Telefoon: ${d.phone}`);
        if (d.address) parts.push(`Adres: ${d.address}`);
        const headline = pickTranslation(d.headline_translations, primaryLocale);
        if (headline) parts.push(headline);
        break;
      }
      // image / gallery: no textual knowledge.
      default:
        break;
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

/**
 * Derive a human-readable title for a page document. Prefers the
 * SEO meta title for the primary locale, falls back to the slug.
 */
export function pageDocumentTitle(page: Page, primaryLocale: AgentLanguage): string {
  const map = page.seo_meta?.title_translations as TranslationMap | undefined;
  const fromMeta = pickTranslation(map, primaryLocale);
  if (fromMeta) return fromMeta;
  if (page.slug === 'home') return 'Homepage';
  return page.slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export interface KnowledgeSnapshotInput {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  primaryLocale?: AgentLanguage;
}

/**
 * Walk every page for the tenant and produce a draft list of
 * knowledge documents the sync action can persist. Returns the
 * shape the repository's `create` expects (sans id/timestamps).
 */
export async function buildKnowledgeBaseSnapshot(
  input: KnowledgeSnapshotInput
): Promise<Array<Omit<KnowledgeBaseDocument, 'id' | 'created_at' | 'updated_at'>>> {
  const locale = input.primaryLocale ?? 'nl';
  const pages = await pagesRepo.listByTenant(input.tenantId);
  const docs: Array<Omit<KnowledgeBaseDocument, 'id' | 'created_at' | 'updated_at'>> = [];

  for (const page of pages) {
    if (page.status !== 'published') continue;
    const blocks = await blocksRepo.findByPageId(page.id);
    const content = extractFromPageBlocks(blocks, locale);
    if (content.trim().length === 0) continue;

    const slugSuffix = page.slug === 'home' ? '' : `/${page.slug}`;
    docs.push({
      agent_id: input.agentId,
      tenant_id: input.tenantId,
      elevenlabs_document_id: null,
      type: 'page_content',
      title: pageDocumentTitle(page, locale),
      content,
      source_url: `/sites/${input.tenantSlug}${slugSuffix}`,
      page_id: page.id,
      block_id: null,
      status: 'pending',
      last_synced_at: null,
      sync_error: null,
      created_by_user_id: null,
    });
  }

  return docs;
}
