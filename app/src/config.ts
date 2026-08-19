import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * عنوان الخلفية.
 *
 * ترتيب الأولوية:
 *   1. متغيّر البيئة EXPO_PUBLIC_API_URL  ← ما نستخدمه في الإنتاج
 *   2. القيمة في app.json → extra.apiUrl
 *   3. عنوان محلّي مناسب لكل منصّة
 *
 * ملاحظة مهمّة: محاكي أندرويد لا يرى `localhost` — لأنه جهاز مستقلّ.
 * العنوان 10.0.2.2 هو جهازك من داخل المحاكي.
 * ولتجربة التطبيق على جوال حقيقي: ضع رقم IP جهازك على الشبكة، مثلًا
 *   EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api/v1
 */
function localApiUrl(): string {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api/v1';
  return 'http://127.0.0.1:8000/api/v1';
}

/** نسخة الويب المرفوعة بجانب الخلفية على النطاق نفسه. */
function sameOriginApiUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return `${window.location.origin}/api/v1`;
}

const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL = (
  // 1) متغيّر البناء — الطريقة المعتمدة للإنتاج
  process.env.EXPO_PUBLIC_API_URL ||
  // 2) التطوير المحلّي
  (__DEV__ ? localApiUrl() : null) ||
  // 3) القيمة المكتوبة في app.json
  fromExtra ||
  // 4) نسخة ويب على نفس نطاق الخادم
  sameOriginApiUrl() ||
  localApiUrl()
).replace(/\/$/, '');

/**
 * إصدار التطبيق — يُقارَن بـ `min_version` و`latest_version` من app-config.
 *
 * مصدران بالترتيب:
 *   1. متغيّر يُحقَن في الحزمة وقت البناء — يبقى صحيحًا مهما جرى بعده.
 *   2. `Constants.expoConfig` — يقرأه الجهاز من الملف المثبَّت، إلا حين يشغّل
 *      حزمة تحديث عن بُعد فيقرأه من بيان التحديث.
 *
 * ⚠️ و`null` حين يتعذّر الاثنان — **ولا نخترع قيمة**. كانت القيمة الاحتياطية
 * `'1.0.0'` أي «افترض أقدم إصدار ممكن»، فحوّلت بيانًا ناقصًا إلى قفل تامّ:
 * تطبيق يظنّ نفسه قديمًا فيطالب بتحديث، ثم يطالب به مرة أخرى بعد تثبيته.
 * الجهل بالإصدار سبب لعدم الحجب لا سبب له.
 */
export const APP_VERSION: string | null =
  process.env.EXPO_PUBLIC_APP_VERSION || Constants.expoConfig?.version || null;

/** مفاتيح التخزين المحلّي. */
export const STORAGE = {
  tokens: 'souq.tokens',
  user: 'souq.user',
  language: 'souq.language',
  themeMode: 'souq.themeMode',
  appConfig: 'souq.appConfig',
  appConfigEtag: 'souq.appConfigEtag',
  guestFavorites: 'souq.guestFavorites',
  cache: 'souq.cache.',
} as const;

/** مهلة الطلب — الإنترنت في الرقة ضعيف، والانتظار الطويل أسوأ من رسالة خطأ. */
export const REQUEST_TIMEOUT_MS = 20000;

/**
 * مهلة رفع الملفات — أطول بكثير، وعن قصد.
 *
 * الـ 20 ثانية أعلاه مناسبة لطلب JSON صغير: إن تأخّر هذا الوقت فالشبكة مقطوعة
 * فعلًا. لكنها قاتلة لصورة بحجم ميغابايتين ترفعها من جوال في الرقة إلى خادم في
 * ألمانيا — الرفع يقطع في منتصفه، والمستخدم يظنّ أن إعلانه نُشر بصوره.
 */
export const UPLOAD_TIMEOUT_MS = 120000;
