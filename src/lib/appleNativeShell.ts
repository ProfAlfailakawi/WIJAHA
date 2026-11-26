/**
 * كاشف تطبيق iOS الوحيد في الواجهة (على نمط ميزان #462).
 *
 * تطبيق وجاهة على iOS غلافُ Capacitor يفتح الموقع الحي نفسه، وCapacitor يحقن `window.Capacitor`
 * قبل تحميل الصفحة. داخل التطبيق فقط تُخفى الأسعار والاشتراك والدفع الخارجي ودعوات الترقية
 * (إرشادات App Store 3.1.1)؛ أما المتصفح فلا يتغيّر فيه شيء. لا يكفي «وضع الشاشة الرئيسية»
 * (standalone) ليُعدّ تطبيقًا: تطبيق الويب المثبّت من Safari يبقى موقعًا.
 */
type CapacitorLike = { isNativePlatform?: () => boolean; getPlatform?: () => string };
type WindowLike = { Capacitor?: CapacitorLike } | undefined;

const currentWindow = (): WindowLike =>
  typeof window === 'undefined' ? undefined : (window as unknown as WindowLike);

/** صحيح داخل تطبيق iOS وحده؛ خطأ دائمًا في المتصفح والخادم والاختبارات. */
export function isAppleNativeShell(win: WindowLike = currentWindow()): boolean {
  try {
    const cap = win?.Capacitor;
    return !!(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios');
  } catch {
    return false;
  }
}

/** هل تُعرض الأسعار والاشتراكات وأزرار الدفع والترقية؟ في الموقع نعم، وفي تطبيق iOS لا. */
export const commerceVisible = (native: boolean = isAppleNativeShell()): boolean => !native;

/** يُتبَع رابط بوابة الدفع الخارجية في الموقع فقط، وبشرط أن يكون https. */
export const followCheckoutUrl = (url: string | undefined | null, native: boolean = isAppleNativeShell()): boolean =>
  !native && typeof url === 'string' && url.startsWith('https://');
