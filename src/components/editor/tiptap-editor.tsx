'use client';

import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';

import type { Editor } from '@tiptap/core';

interface TipTapEditorCopy {
  bold: string;
  italic: string;
  link: string;
  linkUrl: string;
  linkApply: string;
  linkCancel: string;
  linkRemove: string;
  heading: string;
  bulletList: string;
}

export interface TipTapEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
  copy: TipTapEditorCopy;
}

/**
 * Rich-text editor used by the customer-facing block-edit forms
 * (step 41, fase 12 part 3/8). StarterKit gives us paragraphs,
 * headings, bold, italic, lists, blockquote, code-block, etc.;
 * Link adds inline anchors.
 *
 * The toolbar lives above the editor (rather than a floating
 * bubble) because TipTap 3 moved BubbleMenu to a separate
 * package and the fixed-toolbar UX is simpler — more obvious
 * affordance, no positioning gymnastics, works the same on
 * touch.
 *
 * `immediatelyRender: false` is required for Next.js / SSR —
 * TipTap would otherwise throw a hydration mismatch because the
 * editor DOM is built on the client only.
 */
export function TipTapEditor({
  initialContent,
  onChange,
  placeholder,
  id,
  copy,
}: TipTapEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'data-testid': id ? `tiptap-content-${id}` : 'tiptap-content',
        class: 'prose prose-sm max-w-none min-h-[150px] focus:outline-none px-3 py-2',
      },
    },
  });

  if (!editor) {
    return (
      <div
        data-testid="tiptap-loading"
        className="border-border text-muted-foreground min-h-[150px] rounded-md border px-3 py-2 text-sm"
      >
        …
      </div>
    );
  }

  return (
    <div
      data-testid={id ? `tiptap-editor-${id}` : 'tiptap-editor'}
      className="border-border bg-background overflow-hidden rounded-md border"
    >
      <div
        data-testid="tiptap-toolbar"
        className="border-border/60 bg-muted/40 flex items-center gap-1 border-b px-2 py-1"
      >
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          testid="tiptap-bold"
          aria-label={copy.bold}
          title={copy.bold}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          testid="tiptap-italic"
          aria-label={copy.italic}
          title={copy.italic}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          testid="tiptap-h2"
          aria-label={copy.heading}
          title={copy.heading}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          testid="tiptap-bulletlist"
          aria-label={copy.bulletList}
          title={copy.bulletList}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => setLinkDialogOpen(true)}
          testid="tiptap-link"
          aria-label={copy.link}
          title={copy.link}
        >
          🔗
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
      {placeholder && editor.isEmpty && (
        <div
          aria-hidden
          className="text-muted-foreground pointer-events-none px-3 pb-3 text-xs italic"
        >
          {placeholder}
        </div>
      )}

      {linkDialogOpen && (
        <LinkDialog editor={editor} onClose={() => setLinkDialogOpen(false)} copy={copy} />
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  testid,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
  'aria-label': string;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor focus
      onClick={onClick}
      data-testid={testid}
      data-active={active ? 'true' : 'false'}
      className={`hover:bg-muted rounded px-2 py-1 font-mono text-xs ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function LinkDialog({
  editor,
  onClose,
  copy,
}: {
  editor: Editor;
  onClose: () => void;
  copy: TipTapEditorCopy;
}) {
  const [url, setUrl] = useState<string>((editor.getAttributes('link').href as string) ?? '');

  return (
    <div
      data-testid="tiptap-link-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={copy.link}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border-border w-full max-w-md rounded-lg border p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-sm font-semibold">{copy.link}</h3>
        <label className="block">
          <span className="text-muted-foreground text-xs">{copy.linkUrl}</span>
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            data-testid="tiptap-link-input"
            className="bg-background border-input mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          {editor.isActive('link') && (
            <button
              type="button"
              data-testid="tiptap-link-remove"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                onClose();
              }}
              className="text-destructive font-mono text-xs"
            >
              {copy.linkRemove}
            </button>
          )}
          <button
            type="button"
            data-testid="tiptap-link-cancel"
            onClick={onClose}
            className="ring-border bg-background hover:bg-muted rounded-md px-3 py-1.5 font-mono text-xs ring-1"
          >
            {copy.linkCancel}
          </button>
          <button
            type="button"
            data-testid="tiptap-link-apply"
            onClick={() => {
              const next = url.trim();
              if (next.length === 0) {
                editor.chain().focus().unsetLink().run();
              } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
              }
              onClose();
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-mono text-xs"
          >
            {copy.linkApply}
          </button>
        </div>
      </div>
    </div>
  );
}
