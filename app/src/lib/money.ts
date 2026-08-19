import type { AppConfig, Lang } from '../api/types';

/**
 * العملات والتحويل — نسخة العميل من apps/core/money.py.
 *
 * لماذا يجري التحويل على الجهاز لا على الخادم؟ لأن تبديل العملة من الترويسة
 * يجب أن يكون فوريًا. لو حوّلنا على الخادم لصار كل ضغط على أيقونة العملة
 * إعادة تحميل لكل قائمة معروضة — على إنترنت الرقة، ثانيتان مقابل ضربَي قسمة.
 *
 * والقاعدة نفسها هنا: **رقم البائع لا يُمسّ**. نعرض سعره بعملته كما كتبه،
 * ونضيف تحته تقديرًا بعملة القارئ حين نملك سعر صرف — وإلا لا نضيف شيئًا.
 */

export type Rates = Record<string, number>;

/** «≈» تسبق كل مبلغ محوَّل — إشارة بصرية أن الرقم تقدير لا سعر. */
const APPROX = '≈';

const NEGOTIABLE: Record<Lang, string> = {
  ar: 'على السوم',
  tr: 'Pazarlıklı',
  en: 'Negotiable',
};

function entry(config: AppConfig, code: string) {
  return config.currency.catalogue.find((c) => c.code === code) ?? null;
}

export function symbolOf(config: AppConfig, code: string, lang: Lang): string {
  const found = entry(config, code);
  return found ? found.symbols[lang] || found.symbol : code;
}

/** جدول الأسعار كاملًا — المحور نفسه يساوي واحدًا ولا يدخله أحد يدويًا. */
function rateTable(config: AppConfig): Rates {
  return { [config.currency.base]: 1, ...(config.currency.rates ?? {}) };
}

/**
 * يحوّل مبلغًا عبر محور الدولار.
 *
 * يعيد `null` حين ينقص سعر صرف — لا صفرًا ولا المبلغ كما هو. الصفر رقمٌ
 * يقرأه المستخدم على أنه سعر، و«لا نعرف» يجب أن تظهر بوصفها لا نعرف.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  config: AppConfig,
): number | null {
  if (from === to) return amount;
  const table = rateTable(config);
  const source = table[from];
  const target = table[to];
  if (!source || !target || source <= 0) return null;
  return (amount / source) * target;
}

/**
 * يقرّب إلى ثلاثة أرقام معنوية.
 *
 * «≈ 4,512,347 ل.س» يدّعي دقّة لا نملكها — السعر من جدول يدوي قد يكون عمره
 * أيام. «≈ 4,510,000» يقول الحقيقة: تقدير.
 */
export function roundApprox(value: number, digits = 3): number {
  if (!value) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(value))) + 1 - digits;
  if (magnitude <= 0) return Math.round(value);
  const step = 10 ** magnitude;
  return Math.round(value / step) * step;
}

function formatNumber(value: number, decimals: number): string {
  // أرقام لاتينية في اللغات الثلاث (plan2 §5)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** «8,500 $» — الرقم ثم الرمز، في اللغات الثلاث. */
export function formatAmount(
  amount: number | null,
  code: string,
  config: AppConfig,
  lang: Lang,
): string {
  if (amount === null || amount === undefined) return NEGOTIABLE[lang];
  const decimals = entry(config, code)?.decimals ?? 0;
  const symbol = symbolOf(config, code, lang);
  const number = formatNumber(amount, decimals);
  return symbol ? `${number} ${symbol}` : number;
}

/**
 * نصّ التحويل التقريبي — أو `null` فلا يُعرض سطر ثانٍ إطلاقًا.
 *
 * نعيد `null` في ثلاث حالات: العملتان واحدة · لا سعر صرف · السعر «على السوم».
 * في كلّها إظهار سطر فارغ أو رقم مخترع أسوأ من الصمت.
 */
export function formatApprox(
  amount: number | null,
  from: string,
  to: string,
  config: AppConfig,
  lang: Lang,
): string | null {
  if (amount === null || amount === undefined || from === to) return null;
  const value = convert(amount, from, to, config);
  if (value === null) return null;
  return `${APPROX} ${formatAmount(roundApprox(value), to, config, lang)}`;
}

/** هل ضبط الأدمن أسعار الصرف أصلًا؟ بلا ذلك لا تحويل ولا مفاضلة. */
export function hasRates(config: AppConfig): boolean {
  return Object.keys(config.currency.rates ?? {}).length > 0;
}
