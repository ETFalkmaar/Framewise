/**
 * ElevenLabs Conversational AI client (step 56, fase 15 part 1/9).
 *
 * Wraps the subset of the ElevenLabs API the booking platform uses:
 *  - `createAgent` / `updateAgent` / `deleteAgent`
 *  - `listVoices`
 *  - `addKnowledgeBaseDocument` / `removeKnowledgeBaseDocument`
 *
 * **Stub mode**: when `ELEVENLABS_API_KEY` is missing the client
 * still works — it returns deterministic stub IDs + the seeded
 * voice list so the rest of the app can be developed + tested
 * without external API dependency. Production deploys set the env
 * var and the same surface flips to live calls automatically.
 */

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsConfig {
  /** API key — `undefined` switches the client into stub mode. */
  apiKey?: string;
  /** Force stub mode regardless of `apiKey` (used by tests). */
  stubMode?: boolean;
  /** Override fetch implementation (used by tests). */
  fetcher?: typeof fetch;
}

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
  voice_id?: string;
  language: string;
  first_message: string;
}

export interface CreateAgentInput {
  name: string;
  voice_id?: string;
  first_message: string;
  language: string;
  /** Initial knowledge-base text chunks (joined into one document). */
  knowledge_base?: string[];
}

export interface CreateAgentResult {
  agent_id: string;
  /** `live` when the real API was hit, `stub` when we faked it. */
  mode: 'live' | 'stub';
}

export interface UpdateAgentInput {
  name?: string;
  voice_id?: string;
  first_message?: string;
  language?: string;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  language: string;
  /** Display tag for the UI ("warm" / "professional" / etc.). */
  accent: string;
  /** Preview audio URL — stub mode points at a placeholder. */
  sample_url: string;
}

export interface KnowledgeBaseDocumentResult {
  document_id: string;
  mode: 'live' | 'stub';
}

/**
 * The seeded voice list returned by `listVoices()` in stub mode.
 * Six voices spanning the four supported agent languages — enough
 * to exercise the voice-picker UI in step 57 without an API key.
 */
export const STUB_VOICES: ElevenLabsVoice[] = [
  {
    voice_id: 'stub-voice-nl-anna',
    name: 'Anna',
    language: 'nl',
    accent: 'warm',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-anna.mp3',
  },
  {
    voice_id: 'stub-voice-nl-pieter',
    name: 'Pieter',
    language: 'nl',
    accent: 'professional',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-pieter.mp3',
  },
  {
    voice_id: 'stub-voice-nl-saskia',
    name: 'Saskia',
    language: 'nl',
    accent: 'casual',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-saskia.mp3',
  },
  {
    voice_id: 'stub-voice-fr-marie',
    name: 'Marie',
    language: 'fr',
    accent: 'professional',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-marie.mp3',
  },
  {
    voice_id: 'stub-voice-en-james',
    name: 'James',
    language: 'en',
    accent: 'warm',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-james.mp3',
  },
  {
    voice_id: 'stub-voice-es-lucia',
    name: 'Lucía',
    language: 'es',
    accent: 'professional',
    sample_url: 'https://framewise-pi.vercel.app/audio/stub-lucia.mp3',
  },
];

export class ElevenLabsClient {
  private config: ElevenLabsConfig;

  constructor(config: ElevenLabsConfig = {}) {
    this.config = config;
  }

  /** True when the client is faking responses instead of calling the API. */
  isStubMode(): boolean {
    return Boolean(this.config.stubMode) || !this.config.apiKey;
  }

  private fetcher(): typeof fetch {
    return this.config.fetcher ?? fetch;
  }

  private headers(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new Error('ElevenLabsClient: missing apiKey (live mode required)');
    }
    return {
      'xi-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async createAgent(input: CreateAgentInput): Promise<CreateAgentResult> {
    if (this.isStubMode()) {
      return {
        agent_id: `stub-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: 'stub',
      };
    }
    const res = await this.fetcher()(`${ELEVENLABS_API_BASE}/convai/agents`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name: input.name,
        conversation_config: {
          agent: {
            first_message: input.first_message,
            language: input.language,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs createAgent ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as { agent_id?: string };
    if (!data.agent_id) {
      throw new Error('ElevenLabs createAgent: missing agent_id in response');
    }
    return { agent_id: data.agent_id, mode: 'live' };
  }

  async updateAgent(agentId: string, patch: UpdateAgentInput): Promise<{ mode: 'live' | 'stub' }> {
    if (this.isStubMode()) return { mode: 'stub' };
    const res = await this.fetcher()(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({
        name: patch.name,
        conversation_config: {
          agent: {
            first_message: patch.first_message,
            language: patch.language,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs updateAgent ${res.status}: ${res.statusText}`);
    }
    return { mode: 'live' };
  }

  async deleteAgent(agentId: string): Promise<{ mode: 'live' | 'stub' }> {
    if (this.isStubMode()) return { mode: 'stub' };
    const res = await this.fetcher()(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`ElevenLabs deleteAgent ${res.status}: ${res.statusText}`);
    }
    return { mode: 'live' };
  }

  async listVoices(): Promise<ElevenLabsVoice[]> {
    if (this.isStubMode()) return STUB_VOICES;
    const res = await this.fetcher()(`${ELEVENLABS_API_BASE}/voices`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs listVoices ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as {
      voices?: Array<{
        voice_id: string;
        name: string;
        labels?: Record<string, string>;
        preview_url?: string;
      }>;
    };
    return (data.voices ?? []).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.labels?.language ?? 'en',
      accent: v.labels?.accent ?? 'neutral',
      sample_url: v.preview_url ?? '',
    }));
  }

  async addKnowledgeBaseDocument(
    agentId: string,
    text: string,
    name: string
  ): Promise<KnowledgeBaseDocumentResult> {
    if (this.isStubMode()) {
      return {
        document_id: `stub-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: 'stub',
      };
    }
    const res = await this.fetcher()(
      `${ELEVENLABS_API_BASE}/convai/agents/${agentId}/knowledge-base`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ name, text }),
      }
    );
    if (!res.ok) {
      throw new Error(`ElevenLabs addKnowledgeBaseDocument ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as { document_id?: string };
    if (!data.document_id) {
      throw new Error('ElevenLabs addKnowledgeBaseDocument: missing document_id');
    }
    return { document_id: data.document_id, mode: 'live' };
  }

  async removeKnowledgeBaseDocument(
    agentId: string,
    documentId: string
  ): Promise<{ mode: 'live' | 'stub' }> {
    if (this.isStubMode()) return { mode: 'stub' };
    const res = await this.fetcher()(
      `${ELEVENLABS_API_BASE}/convai/agents/${agentId}/knowledge-base/${documentId}`,
      { method: 'DELETE', headers: this.headers() }
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`ElevenLabs removeKnowledgeBaseDocument ${res.status}: ${res.statusText}`);
    }
    return { mode: 'live' };
  }
}

/**
 * Convenience factory — pulls the API key from the env so call sites
 * don't have to. Wraps the env access for testability (tests can swap
 * in a fixture client via the `ElevenLabsClient` constructor).
 */
export function createElevenLabsClient(): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
}
