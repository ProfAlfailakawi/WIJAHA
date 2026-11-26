import test from 'node:test';
import assert from 'node:assert/strict';
import { commerceVisible, followCheckoutUrl, isAppleNativeShell } from './appleNativeShell.ts';

const cap = (native: boolean, platform: string) => ({
  Capacitor: { isNativePlatform: () => native, getPlatform: () => platform },
});

test('iOS Capacitor shell is detected', () => {
  assert.equal(isAppleNativeShell(cap(true, 'ios')), true);
});

test('browser, Android, web Capacitor and missing window are not the iOS app', () => {
  assert.equal(isAppleNativeShell(undefined), false);
  assert.equal(isAppleNativeShell({}), false);
  assert.equal(isAppleNativeShell(cap(false, 'web')), false);
  assert.equal(isAppleNativeShell(cap(true, 'android')), false);
  assert.equal(isAppleNativeShell({ Capacitor: {} }), false);
});

test('a throwing Capacitor object never breaks the page', () => {
  const bad = { Capacitor: { isNativePlatform: () => { throw new Error('x'); } } };
  assert.equal(isAppleNativeShell(bad), false);
});

test('outside the app (node has no window) commerce stays visible by default', () => {
  assert.equal(isAppleNativeShell(), false);
  assert.equal(commerceVisible(), true);
});

test('commerce is hidden inside the iOS app only', () => {
  assert.equal(commerceVisible(false), true);
  assert.equal(commerceVisible(true), false);
});

test('external checkout is followed on the web only, and only over https', () => {
  assert.equal(followCheckoutUrl('https://checkout.stripe.com/c/x', false), true);
  assert.equal(followCheckoutUrl('https://checkout.stripe.com/c/x', true), false);
  assert.equal(followCheckoutUrl('http://evil.example', false), false);
  assert.equal(followCheckoutUrl(undefined, false), false);
});
