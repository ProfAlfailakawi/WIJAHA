import crypto from 'node:crypto';

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
  orgRole: OrgRole;
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
      if (!resource.orgId) return false;
      if (actor.activeOrgId !== resource.orgId) return false;
      return true;
    }
    case 'project:write': {
      if (!resource.orgId || actor.activeOrgId !== resource.orgId) return false;
      if (actor.orgRole === 'viewer') return false;
      return true;
    }
    case 'project:delete': {
      if (!resource.orgId || actor.activeOrgId !== resource.orgId) return false;
      return (
        actor.orgRole === 'org_owner' ||
        actor.orgRole === 'org_admin' ||
        actor.uid === resource.ownerUid
      );
    }
    case 'org:manage_members': {
      if (!resource.orgId || actor.activeOrgId !== resource.orgId) return false;
      return actor.orgRole === 'org_owner' || actor.orgRole === 'org_admin';
    }
    case 'org:manage_billing': {
      if (!resource.orgId || actor.activeOrgId !== resource.orgId) return false;
      return actor.orgRole === 'org_owner';
    }
    case 'admin:access': {
      return (
        actor.platformRole === 'platform_admin' ||
        actor.platformRole === 'expert' ||
        actor.platformRole === 'content_editor' ||
        actor.platformRole === 'senior_reviewer'
      );
    }
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
    case 'requests:manage': {
      return (
        actor.platformRole === 'platform_admin' ||
        actor.platformRole === 'expert' ||
        actor.platformRole === 'senior_reviewer'
      );
    }
    case 'revenue:configure': {
      return actor.platformRole === 'platform_admin';
    }
    default:
      return false;
  }
}

function getDerivedKey(): Buffer {
  const rawSecret =
    process.env.FIELD_ENCRYPTION_KEY || 'wijaha-local-dev-ephemeral-field-key-v1';
  return crypto.createHash('sha256').update(rawSecret).digest();
}

export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDerivedKey(), iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptField(payload: string): string {
  if (!payload.startsWith('v1:')) return payload;
  const parts = payload.split(':');
  if (parts.length !== 4) return '';
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const enc = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getDerivedKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '';
  }
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function hashIp(ip: string | undefined): string {
  if (!ip) return 'anon';
  return crypto
    .createHash('sha256')
    .update(`${ip}:wijaha-ip-salt`)
    .digest('hex')
    .slice(0, 16);
}
