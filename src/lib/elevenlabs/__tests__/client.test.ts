import { describe, expect, it, vi } from 'vitest';

import { ElevenLabsClient, STUB_VOICES, createElevenLabsClient } from '@/lib/elevenlabs/client';

describe('ElevenLabsClient stub mode (step 56)', () => {
  it('defaults to stub mode when no apiKey is provided', () => {
    const client = new ElevenLabsClient();
    expect(client.isStubMode()).toBe(true);
  });

  it('isStubMode() is false when an apiKey is supplied (live mode)', () => {
    const client = new ElevenLabsClient({ apiKey: 'sk-test' });
    expect(client.isStubMode()).toBe(false);
  });

  it('respects an explicit stubMode override even with an apiKey', () => {
    const client = new ElevenLabsClient({ apiKey: 'sk-test', stubMode: true });
    expect(client.isStubMode()).toBe(true);
  });

  it('createAgent returns a stub agent id + mode=stub in stub mode', async () => {
    const client = new ElevenLabsClient();
    const r = await client.createAgent({
      name: 'Test',
      first_message: 'hi',
      language: 'nl',
    });
    expect(r.mode).toBe('stub');
    expect(r.agent_id).toMatch(/^stub-agent-/);
  });

  it('listVoices returns the seeded stub list in stub mode', async () => {
    const client = new ElevenLabsClient();
    const voices = await client.listVoices();
    expect(voices.length).toBe(STUB_VOICES.length);
    expect(voices.some((v) => v.language === 'nl')).toBe(true);
    expect(voices.some((v) => v.language === 'fr')).toBe(true);
    expect(voices.some((v) => v.language === 'en')).toBe(true);
    expect(voices.some((v) => v.language === 'es')).toBe(true);
  });

  it('addKnowledgeBaseDocument returns a stub document id', async () => {
    const client = new ElevenLabsClient();
    const r = await client.addKnowledgeBaseDocument('any-agent', 'text', 'doc');
    expect(r.mode).toBe('stub');
    expect(r.document_id).toMatch(/^stub-doc-/);
  });

  it('deleteAgent + removeKnowledgeBaseDocument return mode=stub without hitting the API', async () => {
    const client = new ElevenLabsClient();
    const a = await client.deleteAgent('any');
    const d = await client.removeKnowledgeBaseDocument('any', 'doc');
    expect(a.mode).toBe('stub');
    expect(d.mode).toBe('stub');
  });
});

describe('ElevenLabsClient live mode (step 56)', () => {
  it('createAgent hits the convai/agents endpoint with the API key header', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ agent_id: 'live-abc' }), { status: 200 })
    ) as unknown as typeof fetch;
    const client = new ElevenLabsClient({ apiKey: 'sk-test', fetcher });
    const r = await client.createAgent({
      name: 'Test',
      first_message: 'hi',
      language: 'nl',
    });
    expect(r.mode).toBe('live');
    expect(r.agent_id).toBe('live-abc');
    const call = (fetcher as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(String(call[0])).toContain('/convai/agents');
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('sk-test');
  });

  it('createAgent throws on a non-2xx response', async () => {
    const fetcher = vi.fn(
      async () => new Response('boom', { status: 500, statusText: 'Server Error' })
    ) as unknown as typeof fetch;
    const client = new ElevenLabsClient({ apiKey: 'sk-test', fetcher });
    await expect(
      client.createAgent({ name: 'x', first_message: 'y', language: 'nl' })
    ).rejects.toThrow(/500/);
  });

  it('listVoices maps the live response shape into our ElevenLabsVoice', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            voices: [
              {
                voice_id: 'live-1',
                name: 'Aria',
                labels: { language: 'en', accent: 'warm' },
                preview_url: 'https://example.com/aria.mp3',
              },
            ],
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;
    const client = new ElevenLabsClient({ apiKey: 'sk-test', fetcher });
    const voices = await client.listVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0]).toEqual({
      voice_id: 'live-1',
      name: 'Aria',
      language: 'en',
      accent: 'warm',
      sample_url: 'https://example.com/aria.mp3',
    });
  });

  it('deleteAgent swallows 404 as success (idempotent cleanup)', async () => {
    const fetcher = vi.fn(
      async () => new Response('', { status: 404, statusText: 'Not Found' })
    ) as unknown as typeof fetch;
    const client = new ElevenLabsClient({ apiKey: 'sk-test', fetcher });
    await expect(client.deleteAgent('gone')).resolves.toEqual({ mode: 'live' });
  });
});

describe('createElevenLabsClient factory (step 56)', () => {
  it('produces a stub-mode client when ELEVENLABS_API_KEY is unset', () => {
    const before = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      const client = createElevenLabsClient();
      expect(client.isStubMode()).toBe(true);
    } finally {
      if (before !== undefined) process.env.ELEVENLABS_API_KEY = before;
    }
  });
});
