import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import type { AppConfig, Lang } from '../api/types';
import { APP_VERSION, STORAGE } from '../config';
import { DARK, LIGHT, RADIUS } from '../theme/tokens';

/**
 * إعدادات التطبيق — تصل من الخادم وتُخزَّن محليًا.
 *
 * تسلسل الإقلاع المقصود (plan2 §4.2):
 *   1. القيم المدمجة  ← التطبيق يفتح فورًا وبشكل صحيح حتى بلا إنترنت
 *   2. آخر نسخة محفوظة على الجهاز
 *   3. الطلب من الخادم بـ ETag ← إن لم تتغيّر النسخة يعود 304 بلا جسم
 *
 * لا شاشة انتظار في أي من الخطوات — المستخدم لا ينتظر الإعدادات ليرى شيئًا.
 */

export const FALLBACK_CONFIG: AppConfig = {
  version: 0,
  // اسم فارغ عمدًا: الترويسة تقع عندها على نصّ الترجمة بلغة المستخدم،
  // وهو أصحّ من فرض العربية على واجهة تركية قبل وصول الإعدادات.
  brand: { name: '', names: { ar: '', tr: '', en: '' }, mark: '', logo: null, launcher_icon: null },
  theme: {
    light: LIGHT,
    dark: DARK,
    font: { family: 'Cairo', scale: 1 },
    radius: RADIUS,
    shadows: 'soft',
    density: 'normal',
    darkModeEnabled: true,
  },
  currency: {
    code: 'SYP',
    symbol: 'ل.س',
    symbols: { ar: 'ل.س', tr: 'SYP', en: 'SYP' },
    position: 'after',
    decimals: 0,
  },
  languages: { supported: ['ar', 'tr', 'en'], default: 'ar', rtl: ['ar'] },
  landing: {
    ar: { headline: '', subline: '', body: '', cta: '', features: [] },
    tr: { headline: '', subline: '', body: '', cta: '', features: [] },
    en: { headline: '', subline: '', body: '', cta: '', features: [] },
    image: null,
  },
  app: {
    latest_version: APP_VERSION ?? '1.0.0',
    min_version: '1.0.0',
    apk_url: '',
    apk_sha256: '',
    apk_size_mb: 0,
    update_message: '',
  },
  features: {
    chat_enabled: false,
    whatsapp_enabled: true,
    featured_enabled: false,
    ratings_enabled: false,
    guest_browsing: true,
    guest_favorites: true,
    phone_verification: false,
    show_view_counts: true,
    show_listing_counts: true,
  },
  limits: {
    listing_expiry_days: 60,
    daily_listing_limit: 5,
    max_photos_per_listing: 10,
    min_description_length: 10,
  },
  support: { whatsapp: '', email: '' },
};

type UpdateState = 'none' | 'available' | 'required';

type AppConfigValue = {
  config: AppConfig;
  loaded: boolean;
  online: boolean;
  updateState: UpdateState;
  refresh: () => Promise<void>;
  /** «450,000 ل.س» — الرقم كما هو، والرمز من الإعدادات (plan2 §6) */
  money: (amount: number | null, lang: Lang) => string;
};

const AppConfigContext = createContext<AppConfigValue | null>(null);

/** يقارن «1.2.0» بـ «1.10.0» بشكل صحيح — المقارنة النصّية تخطئ هنا. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(FALLBACK_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);

  const applyStored = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE.appConfig);
    if (raw) {
      try {
        setConfig(mergeWithFallback(JSON.parse(raw) as AppConfig));
      } catch {
        /* بيانات تالفة — نبقى على القيم المدمجة */
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const etag = await AsyncStorage.getItem(STORAGE.appConfigEtag);
      const result = await api.getAppConfig(etag);
      setOnline(true);
      if (!result) return; // 304 — لا شيء تغيّر
      const next = mergeWithFallback(result.data as AppConfig);
      setConfig(next);
      await AsyncStorage.multiSet([
        [STORAGE.appConfig, JSON.stringify(next)],
        [STORAGE.appConfigEtag, result.etag],
      ]);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await applyStored();
      setLoaded(true);
      await refresh();
    })();
  }, [applyStored, refresh]);

  const updateState: UpdateState = useMemo(() => {
    if (!config.app.apk_url) return 'none';
    // إصدار مجهول ⇒ لا نحجب ولا نُلحّ. الحجب بناءً على تخمين يقفل التطبيق على
    // من يحمل أحدث نسخة أصلًا، ولا مخرج له من الشاشة.
    if (!APP_VERSION) return 'none';
    if (compareVersions(APP_VERSION, config.app.min_version) < 0) return 'required';
    if (compareVersions(APP_VERSION, config.app.latest_version) < 0) return 'available';
    return 'none';
  }, [config.app]);

  const money = useCallback(
    (amount: number | null, lang: Lang) => {
      if (amount === null || amount === undefined) {
        return { ar: 'على السوم', tr: 'Pazarlıklı', en: 'Negotiable' }[lang];
      }
      const { decimals, position, symbols, symbol } = config.currency;
      const number = amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      const sign = symbols?.[lang] || symbol;
      if (!sign) return number;
      return position === 'before' ? `${sign} ${number}` : `${number} ${sign}`;
    },
    [config.currency],
  );

  const value = useMemo<AppConfigValue>(
    () => ({ config, loaded, online, updateState, refresh, money }),
    [config, loaded, online, updateState, refresh, money],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

/** خادم قديم قد لا يرسل مفتاحًا جديدًا — ندمج فوق القيم المدمجة حتى لا ينكسر شيء. */
function mergeWithFallback(incoming: AppConfig): AppConfig {
  return {
    ...FALLBACK_CONFIG,
    ...incoming,
    theme: {
      ...FALLBACK_CONFIG.theme,
      ...incoming.theme,
      light: { ...LIGHT, ...incoming.theme?.light },
      dark: { ...DARK, ...incoming.theme?.dark },
      radius: { ...RADIUS, ...incoming.theme?.radius },
      font: { ...FALLBACK_CONFIG.theme.font, ...incoming.theme?.font },
    },
    currency: { ...FALLBACK_CONFIG.currency, ...incoming.currency },
    languages: { ...FALLBACK_CONFIG.languages, ...incoming.languages },
    features: { ...FALLBACK_CONFIG.features, ...incoming.features },
    limits: { ...FALLBACK_CONFIG.limits, ...incoming.limits },
    app: { ...FALLBACK_CONFIG.app, ...incoming.app },
    support: { ...FALLBACK_CONFIG.support, ...incoming.support },
    brand: { ...FALLBACK_CONFIG.brand, ...incoming.brand },
    landing: { ...FALLBACK_CONFIG.landing, ...incoming.landing },
  };
}

export function useAppConfig(): AppConfigValue {
  const context = useContext(AppConfigContext);
  if (!context) throw new Error('useAppConfig يجب أن يُستخدم داخل AppConfigProvider');
  return context;
}
