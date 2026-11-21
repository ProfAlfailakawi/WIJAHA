/**
 * Expert approval record for the knowledge pack.
 *
 * On 2026-11-20 the project owner, acting as the protocol expert, instructed that all rules be approved.
 * The approval is recorded here (and therefore applied by the seed) because preview databases are rebuilt
 * on every start; a persistent database keeps admin-made changes (see the seed's status-guarded upsert).
 *
 * To record a different reviewer name, change APPROVAL.reviewer only.
 */
export const APPROVAL = {
  reviewer: 'خبير المراسم — مالك المشروع',
  date: '2026-11-20',
  nextReview: '2027-11-20',
  note: 'اعتماد مباشر من المالك بصفته الخبير. لا توجد مراجع رسمية منشورة؛ الأساس هو خبرة المراسم. التواريخ والأنظمة والألقاب تُراجَع سنوياً.',
} as const;

/** Removes the "[مسودة]" / "[تجريبي]" / "[Draft]" / "[Demo]" title markers once a rule is approved. */
export const stripDraftMarker = (title: string): string =>
  title.replace(/^\[(?:تجريبي|مسودة|Demo|Draft)\]\s*/u, '');

export function approveSource<
  T extends { title: string; publisher: string; isDemo: boolean },
>(s: T): T {
  return {
    ...s,
    title: s.title
      .replace(/^مسودة مرجع تجريبي — /u, 'مرجع داخلي — ')
      .replace(/^مسودة مرجع — /u, 'مرجع داخلي — ')
      .replace(/\s*\(نموذج معاينة\)/u, '')
      .replace(/\s*\(تجميع ممارسات معروفة، يتطلب توثيقاً من مصدر رسمي\)/u, ' (خبرة المراسم دون مرجع رسمي منشور)'),
    publisher: 'خبرة المراسم — اعتماد مالك المشروع',
    isDemo: false,
  };
}
