import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Locale } from '../../shared/types.ts';

export interface AiProviderStatus {
  mode: 'mock' | 'gemini';
  intentModel: string;
  generateModel: string;
  embedModel: string;
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
    mode: shouldUseGemini() ? 'gemini' : 'mock',
    intentModel: process.env.AI_MODEL_INTENT || 'gemini-4-hydrogen',
    generateModel: process.env.AI_MODEL_GENERATE || 'gemini-4-hydrogen',
    embedModel: process.env.AI_MODEL_EMBED || 'gemini-embedding-2',
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

export const EMBEDDING_DIMENSIONS = 768;

/**
 * E2: real semantic embeddings from the configured provider.
 * Returns null when no live provider is configured, so callers can fall back to lexical retrieval.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!shouldUseGemini() || texts.length === 0) return null;
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
