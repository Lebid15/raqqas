/**
 * قيم التصميم الافتراضية — نسخة مطابقة لما في الخلفية (apps/core/defaults.py)
 * والذي هو بدوره منقول من design/assets/css/style.css.
 *
 * لماذا مكرّرة هنا؟ لأن التطبيق يجب أن يفتح ويبدو صحيحًا **قبل** أن يصل ردّ
 * app-config — وقبل أن يكون هناك إنترنت أصلًا. هذه شبكة الأمان.
 * ما إن يصل الردّ حتى تحلّ قيم الأدمن محلّها.
 */

export type ColorTokens = {
  brand: string;
  brandText: string;
  brand600: string;
  brand700: string;
  brand50: string;
  brand100: string;
  gold: string;
  gold50: string;
  danger: string;
  danger50: string;
  success: string;
  success50: string;
  info: string;
  info50: string;
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  onBrand: string;
  onGold: string;
};

export const LIGHT: ColorTokens = {
  brand: '#0B7A5D',
  brandText: '#0B7A5D',
  brand600: '#096A51',
  brand700: '#075642',
  brand50: '#E6F4EF',
  brand100: '#C7E7DC',
  gold: '#E8940C',
  gold50: '#FDF3E2',
  danger: '#DC2626',
  danger50: '#FEE9E9',
  success: '#15803D',
  success50: '#E7F6EC',
  info: '#1D4ED8',
  info50: '#E8EEFC',
  bg: '#F4F6F5',
  surface: '#FFFFFF',
  surface2: '#FAFBFB',
  line: '#E4E8E6',
  ink: '#111C18',
  ink2: '#55605B',
  ink3: '#8B958F',
  onBrand: '#FFFFFF',
  onGold: '#2A1B00',
};

export const DARK: ColorTokens = {
  ...LIGHT,
  brand: '#0B7A5D',
  brandText: '#12A87E',
  brand50: '#12312A',
  brand100: '#17463B',
  gold50: '#3A2A0E',
  danger50: '#3A1A1A',
  success50: '#12301F',
  info50: '#16224A',
  bg: '#0F1513',
  surface: '#172220',
  surface2: '#1D2A27',
  line: '#26332F',
  ink: '#EAF0ED',
  ink2: '#A9B5B0',
  ink3: '#77837E',
};

export type RadiusTokens = { sm: number; md: number; lg: number; xl: number; full: number };

export const RADIUS: RadiusTokens = { sm: 8, md: 12, lg: 18, xl: 24, full: 999 };

/** ارتفاعات ثابتة من style.css */
export const SIZES = {
  navHeight: 66,
  headerHeight: 56,
  maxWidth: 1120,
  fabSize: 60,
};

export type ShadowLevel = 'flat' | 'soft' | 'strong';

/**
 * الظلال — القيم الثلاث من style.css (--sh-sm · --sh · --sh-lg).
 * أندرويد لا يفهم إلا `elevation`، لذلك نعطي الاثنين.
 */
export function shadow(level: ShadowLevel, size: 'sm' | 'md' | 'lg', isDark: boolean) {
  if (level === 'flat') return {};

  const strength = level === 'strong' ? 1.6 : 1;
  const table = {
    sm: { opacity: 0.06, radius: 3, offset: 1, elevation: 1 },
    md: { opacity: 0.07, radius: 8, offset: 2, elevation: 3 },
    lg: { opacity: 0.14, radius: 32, offset: 12, elevation: 10 },
  }[size];

  return {
    shadowColor: isDark ? '#000000' : '#10201A',
    shadowOpacity: Math.min(table.opacity * strength * (isDark ? 5 : 1), 0.6),
    shadowRadius: table.radius * strength,
    shadowOffset: { width: 0, height: table.offset },
    elevation: Math.round(table.elevation * strength),
  };
}

/** الكثافة تضرب المسافات الداخلية — من محرّر التصميم. */
export const DENSITY_SCALE = { compact: 0.85, normal: 1, comfortable: 1.15 } as const;
export type Density = keyof typeof DENSITY_SCALE;
