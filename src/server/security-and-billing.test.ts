import test from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  decryptField,
  encryptField,
  type AuthActor,
} from './auth/rbac.ts';

const orgAlphaOwner: AuthActor = {
  uid: 'demo:sara',
  email: 'sara@org-alpha.demo',
  name: 'Sara',
  platformRole: 'user',
  activeOrgId: 'org_alpha',
  orgRole: 'org_owner',
  expertSuggestionsEnabled: true,
  mfaVerified: false,
};

const orgBetaOwner: AuthActor = {
  uid: 'demo:fahad',
  email: 'fahad@org-beta.demo',
  name: 'Fahad',
  platformRole: 'user',
  activeOrgId: 'org_beta',
  orgRole: 'org_owner',
  expertSuggestionsEnabled: true,
  mfaVerified: false,
};

const contentEditor: AuthActor = {
  uid: 'demo:editor',
  email: 'editor@wijaha.demo',
  name: 'Editor',
  platformRole: 'content_editor',
  activeOrgId: 'personal_editor',
  orgRole: 'org_owner',
  expertSuggestionsEnabled: true,
  mfaVerified: true,
};

const seniorReviewer: AuthActor = {
  uid: 'demo:yousef',
  email: 'yousef@wijaha.demo',
  name: 'Dr. Yousef',
  platformRole: 'senior_reviewer',
  activeOrgId: 'personal_yousef',
  orgRole: 'org_owner',
  expertSuggestionsEnabled: true,
  mfaVerified: true,
};

test('Multi-tenant isolation: user from Org Alpha cannot read, write, or delete any resource in Org Beta (100% blocked)', () => {
  const betaResource = { orgId: 'org_beta', ownerUid: 'demo:fahad' };
  assert.equal(can(orgAlphaOwner, 'project:read', betaResource), false);
  assert.equal(can(orgAlphaOwner, 'project:write', betaResource), false);
  assert.equal(can(orgAlphaOwner, 'project:delete', betaResource), false);
  assert.equal(can(orgAlphaOwner, 'org:manage_members', betaResource), false);
  assert.equal(can(orgAlphaOwner, 'org:manage_billing', betaResource), false);

  // Conversely Org Beta owner can access their own org
  assert.equal(can(orgBetaOwner, 'project:read', betaResource), true);
  assert.equal(can(orgBetaOwner, 'project:write', betaResource), true);
});

test('High-sensitivity knowledge rule approval strictly requires senior_reviewer or platform_admin', () => {
  assert.equal(can(contentEditor, 'content:edit'), true);
  assert.equal(can(contentEditor, 'content:approve_standard'), false);
  assert.equal(can(contentEditor, 'content:approve_high_sensitivity'), false);
  assert.equal(can(seniorReviewer, 'content:approve_high_sensitivity'), true);
});

test('AES-256-GCM field encryption encrypts and decrypts Arabic text losslessly without plaintext exposure', () => {
  const secret = 'استقبال وفد رسمي من جمهورية بولندا لتوقيع مذكرة تفاهم';
  const cipherText = encryptField(secret);
  assert.equal(cipherText.includes('بولندا'), false);
  assert.equal(cipherText.startsWith('v1:'), true);
  assert.equal(decryptField(cipherText), secret);
});
