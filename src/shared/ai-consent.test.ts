import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CONSENT_STORAGE_KEY,
  aiRecipientForMode,
  checkAiConsent,
  clearAiConsent,
  hasAnyAiConsent,
  readAiConsent,
  writeAiConsent,
} from './ai-consent.ts';

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

test('recipient follows the live AI mode; mock sends nothing to a third party', () => {
  assert.equal(aiRecipientForMode('claude'), 'anthropic');
  assert.equal(aiRecipientForMode('gemini'), 'google');
  assert.equal(aiRecipientForMode('mock'), null);
  assert.equal(aiRecipientForMode(undefined), null);
});

test('server guard rejects AI requests without consent for the live provider', () => {
  assert.deepEqual(checkAiConsent('claude', undefined), { ok: false, recipient: 'anthropic' });
  assert.deepEqual(checkAiConsent('claude', ''), { ok: false, recipient: 'anthropic' });
  assert.deepEqual(checkAiConsent('claude', '1'), { ok: false, recipient: 'anthropic' });
  assert.deepEqual(checkAiConsent('claude', 'google'), { ok: false, recipient: 'anthropic' });
  assert.deepEqual(checkAiConsent('gemini', 'anthropic'), { ok: false, recipient: 'google' });
});

test('server guard accepts consent for the matching provider, and mock mode needs none', () => {
  assert.deepEqual(checkAiConsent('claude', 'anthropic'), { ok: true });
  assert.deepEqual(checkAiConsent('claude', ['Anthropic']), { ok: true });
  assert.deepEqual(checkAiConsent('gemini', 'google'), { ok: true });
  assert.deepEqual(checkAiConsent('mock', undefined), { ok: true });
});

test('client gate: no consent stored means the dialog must be shown', () => {
  const store = memoryStore();
  assert.equal(readAiConsent(store, 'anthropic'), false);
  assert.equal(readAiConsent(null, 'anthropic'), false);
  assert.equal(hasAnyAiConsent(store), null);
});

test('client gate: consent is remembered per provider and asked again if the provider changes', () => {
  const store = memoryStore();
  writeAiConsent(store, 'anthropic', new Date('2026-11-27T00:00:00Z'));
  assert.equal(readAiConsent(store, 'anthropic'), true);
  assert.equal(readAiConsent(store, 'google'), false);
  assert.deepEqual(hasAnyAiConsent(store), { recipient: 'anthropic', grantedAt: '2026-11-27T00:00:00.000Z' });
});

test('client gate: withdrawing consent clears it; corrupt storage counts as no consent', () => {
  const store = memoryStore();
  writeAiConsent(store, 'google');
  clearAiConsent(store);
  assert.equal(readAiConsent(store, 'google'), false);
  store.setItem(AI_CONSENT_STORAGE_KEY, '{not json');
  assert.equal(readAiConsent(store, 'google'), false);
  assert.equal(hasAnyAiConsent(store), null);
});
