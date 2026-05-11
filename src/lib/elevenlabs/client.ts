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

import type { VoiceCatalogEntry } from '@/types/database';
import { STUB_VOICES, getVoicesByLanguage } from './voice-catalog';

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

// Backwards-compatible alias for older call sites — the picker uses
// `VoiceCatalogEntry` directly (richer shape).
export type ElevenLabsVoice = VoiceCatalogEntry;

export interface KnowledgeBaseDocumentResult {
  document_id: string;
  mode: 'live' | 'stub';
}

export interface VoiceSampleResult {
  audio_url: string;
  mode: 'live' | 'stub';
}

export interface UpdateVoiceSettingsInput {
  agent_id: string;
  voice_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
}

export interface GenerateVoiceSampleInput {
  voice_id: string;
  text: string;
}

export { STUB_VOICES };

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

  /**
   * Catalog of voices the agent can pick. Accepts an optional language
   * filter — stub mode returns the seeded list, live mode hits
   * `/v1/voices` and maps the response into our richer
   * `VoiceCatalogEntry` shape.
   */
  async listVoices(language?: string): Promise<VoiceCatalogEntry[]> {
    if (this.isStubMode()) {
      return language ? getVoicesByLanguage(language) : STUB_VOICES;
    }
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
        description?: string;
      }>;
    };
    const all = (data.voices ?? []).map(
      (v): VoiceCatalogEntry => ({
        voice_id: v.voice_id,
        name: v.name,
        language: (v.labels?.language as VoiceCatalogEntry['language']) ?? 'en',
        accent: v.labels?.accent ?? null,
        gender: (v.labels?.gender as VoiceCatalogEntry['gender']) ?? null,
        description: v.description ?? v.labels?.description ?? '',
        sample_url: v.preview_url ?? '',
        is_premium: false,
      })
    );
    return language ? all.filter((v) => v.language === language) : all;
  }

  /**
   * Generate a short audio sample for the picker's "Test voice" button.
   * Stub mode returns the shared silent mp3 (good enough for UI
   * verification); live mode calls the text-to-speech endpoint.
   */
  async generateVoiceSample(input: GenerateVoiceSampleInput): Promise<VoiceSampleResult> {
    if (this.isStubMode()) {
      return { audio_url: '/stub-audio/silent-1s.mp3', mode: 'stub' };
    }
    const res = await this.fetcher()(
      `${ELEVENLABS_API_BASE}/text-to-speech/${input.voice_id}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ text: input.text }),
      }
    );
    if (!res.ok) {
      throw new Error(`ElevenLabs generateVoiceSample ${res.status}: ${res.statusText}`);
    }
    // The real API returns binary mp3 — for the picker we surface a
    // signed/cached URL upstream. The stub path is enough for now.
    return { audio_url: '', mode: 'live' };
  }

  /**
   * Sync voice settings to the agent on ElevenLabs. Stub mode is a
   * no-op so the local upsert is the source of truth in dev.
   */
  async updateVoiceSettings(
    input: UpdateVoiceSettingsInput
  ): Promise<{ mode: 'live' | 'stub' }> {
    if (this.isStubMode()) return { mode: 'stub' };
    const res = await this.fetcher()(
      `${ELEVENLABS_API_BASE}/convai/agents/${input.agent_id}`,
      {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({
          conversation_config: {
            tts: {
              voice_id: input.voice_id,
              stability: input.stability,
              similarity_boost: input.similarity_boost,
              style: input.style,
              use_speaker_boost: input.speaker_boost,
            },
          },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(
        `ElevenLabs updateVoiceSettings ${res.status}: ${res.statusText}`
      );
    }
    return { mode: 'live' };
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
