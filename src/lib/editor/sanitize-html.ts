/**
 * Minimal allow-list HTML sanitiser for the TipTap output that
 * lands in `block.data` (step 41, fase 12 part 3/8).
 *
 * Production hardening with DOMPurify lives in step 88 — for now
 * we strip the dangerous parts a TipTap StarterKit + Link config
 * could ever produce in practice. The point is defence-in-depth:
 * TipTap shouldn't emit `<script>` even if a malicious user
 * inspects-and-edits, but if a future extension widens the
 * grammar this list keeps the database clean.
 *
 * Allow-list:
 *   - Block: p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code
 *   - Inline: strong, em, s, u, code, br, a
 *   - Attributes: only `href`, `rel`, `target` on `<a>`; all
 *     other attributes are stripped to avoid `style="…"`,
 *     `class="malicious"`, and any future surface area.
 *
 * Strip-list:
 *   - `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`,
 *     `<form>`, `<input>`, `<svg>`, `<math>` — including content.
 *   - Any element not on the allow-list (tag-stripped, text kept).
 *   - All `on*=` event-handler attributes.
 *   - `href="javascript:…"` / `href="data:…"` (rewritten to `#`).
 */
const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  's',
  'u',
  'br',
  'a',
]);

const STRIP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'svg',
  'math',
  'link',
  'meta',
]);

export function sanitizeHtml(input: string): string {
  if (!input) return '';

  // 1. Drop dangerous elements with their contents.
  let html = input;
  for (const tag of STRIP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
    html = html.replace(re, '');
    // Also self-closing or unclosed.
    const selfClosing = new RegExp(`<${tag}\\b[^>]*/?>`, 'gi');
    html = html.replace(selfClosing, '');
  }

  // 2. Strip every on*= event handler (with or without quotes).
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. Strip `javascript:` / `data:` URL schemes in href.
  html = html.replace(
    /href\s*=\s*("(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*'|(?:javascript|data|vbscript):[^\s>]+)/gi,
    'href="#"'
  );

  // 4. For each tag, if it's NOT in the allow-list, drop the
  //    tag wrapper but keep its inner content. We do this with a
  //    simple regex pass — good enough for TipTap output, which
  //    is well-formed HTML.
  html = html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g,
    (match, rawName: string, rest: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return '';
      if (name === 'a') return stripAttrs(match, rest, ['href', 'rel', 'target']);
      return stripAttrs(match, rest, []);
    }
  );

  return html;
}

function stripAttrs(originalTag: string, rest: string, allow: string[]): string {
  const isClose = originalTag.startsWith('</');
  const selfClose = /\/\s*>$/.test(originalTag);
  if (isClose) return originalTag;

  if (allow.length === 0) {
    return originalTag.replace(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/, (_m, name, slash) =>
      slash ? `<${name} />` : `<${name}>`
    );
  }

  const tagNameMatch = originalTag.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagNameMatch) return originalTag;
  const tagName = tagNameMatch[1];

  // Extract allowed attrs from `rest`.
  const attrs: string[] = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rest)) !== null) {
    const attrName = m[1]!.toLowerCase();
    if (allow.includes(attrName)) attrs.push(`${attrName}=${m[2]}`);
  }

  const inner = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  return selfClose ? `<${tagName}${inner} />` : `<${tagName}${inner}>`;
}
