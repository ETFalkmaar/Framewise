import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from '../sanitize-html';

describe('sanitizeHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('keeps a paragraph with allowed inline marks intact', () => {
    const out = sanitizeHtml('<p>Hello <strong>bold</strong> and <em>italic</em>.</p>');
    expect(out).toBe('<p>Hello <strong>bold</strong> and <em>italic</em>.</p>');
  });

  it('keeps an anchor with href + rel + target', () => {
    const out = sanitizeHtml(
      '<p>see <a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a></p>'
    );
    expect(out).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">'
    );
    expect(out).toContain('link');
  });

  it('strips <script> tags and their contents', () => {
    const out = sanitizeHtml('<p>safe</p><script>alert(1)</script><p>after</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<p>safe</p>');
    expect(out).toContain('<p>after</p>');
  });

  it('strips <style> blocks', () => {
    const out = sanitizeHtml('<style>body{color:red}</style><p>text</p>');
    expect(out).not.toContain('style');
    expect(out).toContain('<p>text</p>');
  });

  it('strips <iframe>', () => {
    const out = sanitizeHtml('<iframe src="https://evil"></iframe><p>after</p>');
    expect(out).not.toContain('iframe');
    expect(out).toContain('<p>after</p>');
  });

  it('removes inline event-handler attributes', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">hi</p>');
    expect(out).toBe('<p>hi</p>');
  });

  it('removes onmouseover even when written without quotes', () => {
    const out = sanitizeHtml('<p onmouseover=evil()>hi</p>');
    expect(out).toBe('<p>hi</p>');
  });

  it('rewrites javascript: hrefs to #', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).toContain('href="#"');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('rewrites data: hrefs to #', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    // After the script-strip pass + href rewrite, the result is an a tag with href=#
    expect(out).toContain('href="#"');
    expect(out).not.toContain('data:');
  });

  it('drops unsupported tags (e.g. <marquee>) but keeps inner text', () => {
    const out = sanitizeHtml('<marquee>moving</marquee>');
    // Tags removed, text kept.
    expect(out).toBe('moving');
  });

  it('drops `style` and `class` attributes from allowed tags', () => {
    const out = sanitizeHtml('<p style="color:red" class="big">x</p>');
    expect(out).toBe('<p>x</p>');
  });

  it('keeps lists + list items', () => {
    const out = sanitizeHtml('<ul><li>a</li><li>b</li></ul>');
    expect(out).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('keeps headings h1-h6', () => {
    const out = sanitizeHtml('<h2>title</h2>');
    expect(out).toBe('<h2>title</h2>');
  });

  it('keeps <br>', () => {
    const out = sanitizeHtml('line1<br>line2');
    expect(out).toContain('<br>');
  });

  it('strips <form> and <input>', () => {
    const out = sanitizeHtml('<form><input type="text"></form>');
    expect(out).toBe('');
  });

  it('keeps text content after stripping unsupported tags', () => {
    const out = sanitizeHtml('<div class="x"><span>hello</span></div>');
    expect(out).toBe('hello');
  });

  it('allows mailto: and tel: hrefs', () => {
    expect(sanitizeHtml('<a href="mailto:foo@bar.com">x</a>')).toContain('mailto:foo@bar.com');
    expect(sanitizeHtml('<a href="tel:+31501234567">x</a>')).toContain('tel:+31501234567');
  });

  it('round-trips a realistic TipTap fragment', () => {
    const tiptapOut =
      '<p>Welkom in <strong>de villa</strong>. Bekijk onze <a href="https://example.com" target="_blank" rel="noopener noreferrer">prijzen</a>.</p>';
    expect(sanitizeHtml(tiptapOut)).toBe(tiptapOut);
  });
});
