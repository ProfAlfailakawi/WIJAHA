import crypto from 'node:crypto';
import { loadAndValidateEnv } from '../config/env.ts';

export type PlatformRole =
  | 'user'
  | 'platform_admin'
  | 'expert'
  | 'content_editor'
  | 'senior_reviewer';

export type OrgRole = 'org_owner' | 'org_admin' | 'member' | 'viewer';

export interface AuthActor {
  uid: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  activeOrgId: string;
  orgRole: OrgRole | null;
  expertSuggestionsEnabled: boolean;
  mfaVerified: boolean;
}

export type RbacAction =
  | 'project:read'
  | 'project:write'
  | 'project:delete'
  | 'org:manage_members'
  | 'org:manage_billing'
  | 'admin:access'
  | 'admin:content'
  | 'admin:requests:own'
  | 'admin:requests:all'
  | 'admin:finance'
  | 'admin:users'
  | 'admin:evals'
  | 'content:edit'
  | 'content:approve_standard'
  | 'content:approve_high_sensitivity'
  | 'requests:manage'
  | 'revenue:configure';

export interface ResourceDescriptor {
  orgId?: string | null;
  ownerUid?: string | null;
  visibility?: string;
  sensitivity?: 'low' | 'medium' | 'high';
}

/**
 * Central RBAC + Multi-Tenant Isolation Guard (Defense Layer 1).
 * Note: platform_admin CANNOT read customer projects from another org without explicit org membership (Section 16.2).
 */
export function can(
  actor: AuthActor | null,
  action: RbacAction,
  resource: ResourceDescriptor = {},
): boolean {
  if (!actor) return false;

  switch (action) {
    case 'project:read': {
      if (!resource.orgId || !actor.orgRole) return false;
      if (actor.activeOrgId !== resource.orgId) return false;
      return true;
    }
    case 'project:write': {
      if (!resource.orgId || !actor.orgRole || actor.activeOrgId !== resource.orgId) return false;
      if (actor.orgRole === 'viewer') return false;
      return true;
    }
    case 'project:delete': {
      if (!resource.orgId || !actor.orgRole || actor.activeOrgId !== resource.orgId) return false;
      return (
        actor.orgRole === 'org_owner' ||
        actor.orgRole === 'org_admin' ||
        actor.uid === resource.ownerUid
      );
    }
    case 'org:manage_members': {
      if (!resource.orgId || !actor.orgRole || actor.activeOrgId !== resource.orgId) return false;
      return actor.orgRole === 'org_owner' || actor.orgRole === 'org_admin';
    }
    case 'org:manage_billing': {
      if (!resource.orgId || !actor.orgRole || actor.activeOrgId !== resource.orgId) return false;
      return actor.orgRole === 'org_owner';
    }
    case 'admin:access':
    case 'admin:content':
    case 'content:edit': {
      return (
        actor.platformRole === 'platform_admin' ||
        actor.platformRole === 'expert' ||
        actor.platformRole === 'content_editor' ||
        actor.platformRole === 'senior_reviewer'
      );
    }
    case 'content:approve_standard': {
      return (
        actor.platformRole === 'platform_admin' ||
        actor.platformRole === 'expert' ||
        actor.platformRole === 'senior_reviewer'
      );
    }
    case 'content:approve_high_sensitivity': {
      // Section 12.2: sensitivity=high requires senior_reviewer
      return actor.platformRole === 'senior_reviewer' || actor.platformRole === 'platform_admin';
    }
    case 'admin:requests:own':
    case 'requests:manage': {
      return (
        actor.platformRole === 'platform_admin' ||
        actor.platformRole === 'expert' ||
        actor.platformRole === 'senior_reviewer'
      );
    }
    case 'admin:requests:all': {
      return actor.platformRole === 'platform_admin' || actor.platformRole === 'senior_reviewer';
    }
    case 'admin:evals': {
      return actor.platformRole === 'platform_admin' || actor.platformRole === 'senior_reviewer';
    }
    case 'admin:finance':
    case 'admin:users':
    case 'revenue:configure': {
      return actor.platformRole === 'platform_admin';
    }
    default:
      return false;
  }
}

export function resolveExpertOwnerTag(actor: AuthActor): 'yousef' | 'ahmad' | null {
  const probe = `${actor.uid} ${actor.email}`.toLowerCase();
  if (probe.includes('yousef')) return 'yousef';
  if (probe.includes('ahmad')) return 'ahmad';
  return null;
}

export function encryptField(plainText: string): string {
  const env = loadAndValidateEnv();
  const version = env.FIELD_ENCRYPTION_KEY_VERSION || 'v1';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', env.fieldEncryptionKeyBytes, iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptField(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || !parts[0].startsWith('v')) return payload;

  const [version, ivHex, tagHex, encHex] = parts;
  const env = loadAndValidateEnv();

  const candidateKeys: Buffer[] = [];
  if (version === env.FIELD_ENCRYPTION_KEY_VERSION) {
    candidateKeys.push(env.fieldEncryptionKeyBytes);
  }
  const rotatedKey = env.previousEncryptionKeys.get(version);
  if (rotatedKey) {
    candidateKeys.push(rotatedKey);
  }
  if (!candidateKeys.includes(env.fieldEncryptionKeyBytes)) {
    candidateKeys.push(env.fieldEncryptionKeyBytes);
  }

  for (const keyBuf of candidateKeys) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
      return dec.toString('utf8');
    } catch {
      // Try next key in rotation list
    }
  }
  return '';
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function hashIp(ip: string | undefined): string {
  if (!ip) return 'anon';
  const salt = process.env.IP_HASH_SALT || loadAndValidateEnv().ipHashSalt;
  return crypto
    .createHash('sha256')
    .update(`${ip}:${salt}`)
    .digest('hex')
    .slice(0, 16);
}
