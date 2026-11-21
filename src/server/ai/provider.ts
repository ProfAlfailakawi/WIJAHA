import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Locale } from '../../shared/types.ts';

export interface AiProviderStatus {
  mode: 'mock' | 'gemini' | 'claude';
  intentModel: string;
  generateModel: string;
  embedModel: string;
  embedProvider: 'none' | 'gemini' | 'vertex';
}

function shouldUseClaude(): boolean {
  if ((process.env.AI_PROVIDER || '').toLowerCase() !== 'claude') return false;
  return (process.env.ANTHROPIC_API_KEY || '').trim().length >= 20;
}

function shouldUseGemini(): boolean {
  const mode = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (mode === 'mock') return false;
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length < 12) {
    return false;
  }
  return mode === 'gemini' || mode === 'auto';
}

export function getAiProviderStatus(): AiProviderStatus {
  return {
    mode: shouldUseClaude() ? 'claude' : shouldUseGemini() ? 'gemini' : 'mock',
    intentModel: shouldUseClaude()
      ? process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5'
      : process.env.AI_MODEL_INTENT || 'gemini-4-hydrogen',
    generateModel: shouldUseClaude()
      ? process.env.CLAUDE_MODEL_GENERATE || 'claude-sonnet-5-5'
      : process.env.AI_MODEL_GENERATE || 'gemini-4-hydrogen',
    embedModel: shouldUseVertexEmbeddings()
      ? process.env.VERTEX_EMBED_MODEL || 'text-embedding-005'
      : process.env.AI_MODEL_EMBED || 'gemini-embedding-2',
    embedProvider: shouldUseVertexEmbeddings() ? 'vertex' : shouldUseGemini() ? 'gemini' : 'none',
  };
}

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

/**
 * Optional Gemini structured JSON call when AI_PROVIDER=gemini|auto and a real key is configured.
 * Falls back cleanly or throws upstream error if explicitly configured for live Gemini.
 */
export async function callGeminiJson<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  locale: Locale;
  fast?: boolean;
  timeoutMs?: number;
}): Promise<T | null> {
  if (shouldUseClaude()) {
    return callClaudeJson<T>(params);
  }
  if (!shouldUseGemini()) {
    return null;
  }
  const ai = getGeminiClient();
  const model = params.fast
    ? process.env.AI_MODEL_INTENT || 'gemini-4-hydrogen'
    : process.env.AI_MODEL_GENERATE || 'gemini-4-hydrogen';

  const response = await ai.models.generateContent({
    model,
    contents: params.userPrompt,
    config: {
      abortSignal: AbortSignal.timeout(params.timeoutMs ?? (params.fast ? 4000 : 20000)),
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json',
      thinkingConfig: {
        thinkingLevel: params.fast ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) return null;
  return JSON.parse(text) as T;
}

/** Claude via the Messages API (plain fetch, no extra dependency). */
async function callClaudeJson<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  fast?: boolean;
  timeoutMs?: number;
}): Promise<T | null> {
  const model = params.fast
    ? process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5'
    : process.env.CLAUDE_MODEL_GENERATE || 'claude-sonnet-5-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: params.fast ? 1024 : 4096,
      system: `${params.systemInstruction}\n\nRespond with a single valid JSON object only: no prose, no markdown fences.`,
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? (params.fast ? 8000 : 40000)),
  });
  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export const EMBEDDING_DIMENSIONS = 768;

/** Vertex AI embeddings authenticate with the service account (no API key): AI_EMBED_PROVIDER=vertex + VERTEX_PROJECT. */
export function shouldUseVertexEmbeddings(): boolean {
  return (process.env.AI_EMBED_PROVIDER || '').toLowerCase() === 'vertex' && Boolean(process.env.VERTEX_PROJECT);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string> {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN; // local measurement/testing only
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) },
  );
  if (!res.ok) throw new Error(`metadata token error ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export type EmbedKind = 'query' | 'document';

async function embedWithVertex(texts: string[], kind: EmbedKind): Promise<number[][]> {
  const project = process.env.VERTEX_PROJECT as string;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  const model = process.env.VERTEX_EMBED_MODEL || 'text-embedding-005';
  const token = await getGoogleAccessToken();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 20) {
    const batch = texts.slice(i, i + 20);
    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          instances: batch.map((content) => ({
            content: content.slice(0, 6000),
            task_type: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
          })),
          parameters: { outputDimensionality: EMBEDDING_DIMENSIONS },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) throw new Error(`Vertex embeddings error ${res.status}`);
    const data = (await res.json()) as { predictions?: Array<{ embeddings?: { values?: number[] } }> };
    for (const p of data.predictions ?? []) out.push(p.embeddings?.values ?? []);
  }
  if (out.length !== texts.length || out.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error('Embedding provider returned an unexpected shape.');
  }
  return out;
}


/**
 * E2: real semantic embeddings from the configured provider.
 * Returns null when no live provider is configured, so callers can fall back to lexical retrieval.
 */
export async function embedTexts(texts: string[], kind: EmbedKind = 'document'): Promise<number[][] | null> {
  if (texts.length === 0) return null;
  if (shouldUseVertexEmbeddings()) return embedWithVertex(texts, kind);
  if (shouldUseClaude() || !shouldUseGemini()) return null;
  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model: process.env.AI_MODEL_EMBED || 'gemini-embedding-2',
    contents: texts,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      abortSignal: AbortSignal.timeout(8000),
    },
  });
  const vectors = (response.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error('Embedding provider returned an unexpected shape.');
  }
  return vectors;
}
