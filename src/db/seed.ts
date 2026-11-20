import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  evalCases,
  experts,
  knowledgeRules,
  memberships,
  orgs,
  planEntitlements,
  plans,
  revenueSplitRules,
  scenarios,
  services,
  sources,
  subscriptions,
  synonyms,
  titlesDictionary,
  users,
} from './schema.ts';
import {
  SEED_EVAL_CASES,
  SEED_EXPERTS,
  SEED_KNOWLEDGE_RULES,
  SEED_PLANS,
  SEED_SCENARIOS,
  SEED_SERVICES,
  SEED_SOURCES,
} from './seed-data.ts';
import { DEFAULT_DIALECT_SYNONYMS } from '../shared/arabic.ts';

/**
 * Seeds strictly non-demo reference catalog data (plans, entitlements,
 * empty revenue split shells, dialect synonyms, specialist profiles, and services).
 * Safe for explicit CLI execution with --allow-production-seed.
 */
export async function seedReferenceData(): Promise<void> {
  // 1. Plans & Entitlements (idempotent)
  for (const p of SEED_PLANS) {
    await db
      .insert(plans)
      .values({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        audienceAr: p.audienceAr,
        audienceEn: p.audienceEn,
        monthlyPriceKwd: p.monthlyPriceKwd,
        annualPriceKwd: p.annualPriceKwd,
        isQuote: p.isQuote,
        taxNoteAr: p.taxNoteAr,
        taxNoteEn: p.taxNoteEn,
        excludedAr: p.excludedAr,
        excludedEn: p.excludedEn,
        sortOrder: p.sortOrder,
        active: true,
      })
      .onConflictDoUpdate({
        target: plans.id,
        set: {
          monthlyPriceKwd: p.monthlyPriceKwd,
          annualPriceKwd: p.annualPriceKwd,
          sortOrder: p.sortOrder,
        },
      });

    await db.delete(planEntitlements).where(eq(planEntitlements.planId, p.id));
    for (const [key, val] of Object.entries(p.entitlements)) {
      await db.insert(planEntitlements).values({
        planId: p.id,
        entitlementKey: key,
        entitlementValue: val,
      });
    }
  }

  // 2. Revenue Split Rules (empty/null by default per Section 3.3)
  for (const ownerType of ['yousef', 'ahmad', 'joint']) {
    await db
      .insert(revenueSplitRules)
      .values({
        id: `split_${ownerType}`,
        ownerType,
        platformSharePct: null,
        yousefSharePct: null,
        ahmadSharePct: null,
        notes: 'بانتظار اتفاق المؤسسين القانوني — قابلة للضبط من لوحة الإدارة',
      })
      .onConflictDoNothing();
  }

  // 3. Dialect Synonyms (idempotent check)
  const existingSyns = await db.select().from(synonyms).limit(1);
  if (existingSyns.length === 0) {
    for (const syn of DEFAULT_DIALECT_SYNONYMS) {
      await db.insert(synonyms).values(syn);
    }
  }

  // 4. Specialist Profiles & Services Catalog
  for (const ex of SEED_EXPERTS) {
    await db
      .insert(experts)
      .values(ex)
      .onConflictDoNothing();
  }

  for (const srv of SEED_SERVICES) {
    await db.insert(services).values(srv).onConflictDoNothing();
  }
}

/**
 * Seeds development-only demo accounts, demo workspaces, draft_demo rules,
 * demo scenarios, and demo evaluation cases.
 * Strictly forbidden when NODE_ENV=production (B1).
 */
export async function seedDemoData(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seedDemoData is strictly forbidden when NODE_ENV=production (B1).');
  }

  const demoUsers = [
    {
      uid: 'demo:admin',
      email: 'admin@wijaha.demo',
      name: 'مدير النظام التجريبي',
      platformRole: 'platform_admin',
      mfaVerified: true,
    },
    {
      uid: 'demo:yousef',
      email: 'yousef@wijaha.demo',
      name: 'د. يوسف الحسني (حساب خبير ومراجع)',
      platformRole: 'senior_reviewer',
      mfaVerified: true,
    },
    {
      uid: 'demo:sara',
      email: 'sara@org-alpha.demo',
      name: 'سارة العتيبي — مديرة مراسم',
      platformRole: 'user',
      mfaVerified: false,
    },
    {
      uid: 'demo:fahad',
      email: 'fahad@org-beta.demo',
      name: 'فهد المطيري — مدير تطوير أعمال',
      platformRole: 'user',
      mfaVerified: false,
    },
    {
      uid: 'demo:noura',
      email: 'noura@individual.demo',
      name: 'نورة الصالح — حساب فردي',
      platformRole: 'user',
      mfaVerified: false,
    },
  ];

  for (const u of demoUsers) {
    await db
      .insert(users)
      .values({
        uid: u.uid,
        email: u.email,
        name: u.name,
        platformRole: u.platformRole,
        mfaVerified: u.mfaVerified,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email: u.email, name: u.name },
      });
  }

  const demoOrgs = [
    {
      id: 'org_alpha',
      name: 'مجموعة الخليج الدولية (تجريبي)',
      nameEn: 'Gulf International Group (Demo)',
      planId: 'team',
      isPersonal: false,
    },
    {
      id: 'org_beta',
      name: 'شركة الأفق للتطوير (تجريبي)',
      nameEn: 'Horizon Development Co. (Demo)',
      planId: 'pro',
      isPersonal: false,
    },
    {
      id: 'personal_demo_noura',
      name: 'المساحة الشخصية — نورة',
      nameEn: 'Personal Workspace — Noura',
      planId: 'free',
      isPersonal: true,
    },
    {
      id: 'personal_demo_admin',
      name: 'مساحة الإدارة',
      nameEn: 'Admin Workspace',
      planId: 'pro',
      isPersonal: true,
    },
    {
      id: 'personal_demo_yousef',
      name: 'مساحة الخبير — د. يوسف',
      nameEn: 'Expert Workspace — Dr. Yousef',
      planId: 'pro',
      isPersonal: true,
    },
  ];

  for (const o of demoOrgs) {
    await db.insert(orgs).values(o).onConflictDoNothing();
  }

  const demoMemberships = [
    { userUid: 'demo:sara', orgId: 'org_alpha', role: 'org_owner' },
    { userUid: 'demo:fahad', orgId: 'org_beta', role: 'org_owner' },
    { userUid: 'demo:noura', orgId: 'personal_demo_noura', role: 'org_owner' },
    { userUid: 'demo:admin', orgId: 'personal_demo_admin', role: 'org_owner' },
    { userUid: 'demo:yousef', orgId: 'personal_demo_yousef', role: 'org_owner' },
  ];

  for (const m of demoMemberships) {
    const existingMem = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userUid, m.userUid));
    if (!existingMem.some((row) => row.orgId === m.orgId)) {
      await db.insert(memberships).values(m);
    }
  }

  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await db
    .insert(subscriptions)
    .values([
      {
        id: 'sub_org_alpha',
        orgId: 'org_alpha',
        userUid: 'demo:sara',
        planId: 'team',
        billingCycle: 'annual',
        status: 'active',
        currentPeriodEnd: nextMonth,
      },
      {
        id: 'sub_org_beta',
        orgId: 'org_beta',
        userUid: 'demo:fahad',
        planId: 'pro',
        billingCycle: 'monthly',
        status: 'active',
        currentPeriodEnd: nextMonth,
      },
    ])
    .onConflictDoNothing();

  for (const s of SEED_SOURCES) {
    await db
      .insert(sources)
      .values(s)
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          title: s.title,
          publisher: s.publisher,
          isDemo: s.isDemo,
          type: s.type,
          reliability: s.reliability,
          url: 'url' in s ? (s.url as string) : null,
        },
      });
  }

  await db
    .insert(titlesDictionary)
    .values([
      {
        id: 'TD-DEMO-01',
        country: 'KW',
        roleAr: 'وزير',
        roleEn: 'Minister',
        salutationAr: 'معالي الوزير (يُراجع الدليل الرسمي)',
        salutationEn: 'His/Her Excellency the Minister',
        isDemo: true,
      },
      {
        id: 'TD-DEMO-02',
        country: 'PL',
        roleAr: 'رئيس جامعة (Rector)',
        roleEn: 'University Rector',
        salutationAr: 'سعادة الأستاذ الدكتور رئيس الجامعة',
        salutationEn: 'His/Her Magnificence Rector Professor',
        isDemo: true,
      },
    ])
    .onConflictDoNothing();

  for (const r of SEED_KNOWLEDGE_RULES) {
    await db
      .insert(knowledgeRules)
      .values({
        id: r.id,
        titleAr: r.titleAr,
        titleEn: r.titleEn,
        bodyAr: r.bodyAr,
        bodyEn: r.bodyEn,
        level: r.level,
        topics: r.topics,
        countries: r.countries,
        contexts: r.contexts,
        sensitivity: r.sensitivity,
        sources: r.sources,
        exceptions: r.exceptions,
        status: r.status,
        authorUid: r.authorUid,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        reviewDueAt: r.reviewDueAt,
        version: r.version,
        embeddingAr: r.embeddingAr,
        embeddingEn: r.embeddingEn,
        normalizedSearchText: r.normalizedSearchText,
      })
      // Seed-managed content is refreshed only while an admin has never touched the row (version 1);
      // any admin edit or status change bumps the version and is never overwritten.
      .onConflictDoUpdate({
        target: knowledgeRules.id,
        set: {
          titleAr: r.titleAr,
          titleEn: r.titleEn,
          bodyAr: r.bodyAr,
          bodyEn: r.bodyEn,
          level: r.level,
          topics: r.topics,
          countries: r.countries,
          contexts: r.contexts,
          sensitivity: r.sensitivity,
          sources: r.sources,
          exceptions: r.exceptions,
          status: r.status,
          reviewedBy: r.reviewedBy,
          reviewedAt: r.reviewedAt,
          reviewNote: r.reviewNote,
          reviewDueAt: r.reviewDueAt,
          embeddingAr: r.embeddingAr,
          embeddingEn: r.embeddingEn,
          normalizedSearchText: r.normalizedSearchText,
        },
        setWhere: eq(knowledgeRules.version, 1),
      });
  }

  for (const sc of SEED_SCENARIOS) {
    await db
      .insert(scenarios)
      .values({
        id: sc.id,
        titleAr: sc.titleAr,
        titleEn: sc.titleEn,
        descriptionAr: sc.descriptionAr,
        descriptionEn: sc.descriptionEn,
        audience: sc.audience,
        level: sc.level,
        competencies: sc.competencies,
        learningObjectivesAr: sc.learningObjectivesAr,
        learningObjectivesEn: sc.learningObjectivesEn,
        estimatedMinutes: sc.estimatedMinutes,
        contentOwner: sc.contentOwner,
        learningDesignOwner: sc.learningDesignOwner,
        status: sc.status,
        isDemo: sc.isDemo,
        coverImage: sc.coverImage,
        nodes: sc.nodes as unknown as Array<Record<string, unknown>>,
        rubric: sc.rubric as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: scenarios.id,
        set: { coverImage: sc.coverImage },
      });
  }

  for (const ev of SEED_EVAL_CASES) {
    await db
      .insert(evalCases)
      .values({
        id: ev.id,
        queryText: ev.queryText,
        locale: ev.locale,
        dialect: ev.dialect,
        expectedIntent: ev.expectedIntent,
        expectedSensitivity: ev.expectedSensitivity,
        expectedBlocks: ev.expectedBlocks,
        expectedRuleIds: ev.expectedRuleIds,
        mandatoryKeywords: ev.mandatoryKeywords,
        forbiddenKeywords: ev.forbiddenKeywords,
        isDemo: true,
      })
      .onConflictDoNothing();
  }
}
