import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';

import { api } from '../api/client';
import type { Lang } from '../api/types';
import { STORAGE } from '../config';
import ar, { type Dictionary } from './ar';
import en from './en';
import tr from './tr';

const DICTIONARIES: Record<Lang, Dictionary> = { ar, tr, en };
const RTL_LANGUAGES: Lang[] = ['ar'];

export const LANGUAGE_NAMES: Record<Lang, string> = {
  ar: 'العربية',
  tr: 'Türkçe',
  en: 'English',
};

type I18nValue = {
  lang: Lang;
  isRTL: boolean;
  t: Dictionary;
  setLanguage: (lang: Lang) => Promise<void>;
  /** يعوّض {name} داخل النصّ — مثل tp(t.auth.welcomeUser, { name }) */
  tp: (template: string, values: Record<string, string | number>) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

function deviceLanguage(): Lang {
  const codes = Localization.getLocales().map((l) => l.languageCode?.toLowerCase());
  for (const code of codes) {
    if (code === 'ar' || code === 'tr' || code === 'en') return code;
  }
  return 'ar';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(STORAGE.language)) as Lang | null;
      const initial = saved ?? deviceLanguage();
      setLang(initial);
      api.setLanguage(initial);
      setReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (next: Lang) => {
    setLang(next);
    api.setLanguage(next);
    await AsyncStorage.setItem(STORAGE.language, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const isRTL = RTL_LANGUAGES.includes(lang);
    // نبقي I18nManager على LTR ونتحكّم بالاتجاه من الأنماط.
    // السبب: تبديل I18nManager يفرض إعادة تشغيل التطبيق — والمستخدم الذي
    // يغيّر اللغة لا يتوقّع أن ينغلق التطبيق في وجهه.
    if (I18nManager.isRTL) I18nManager.allowRTL(false);

    return {
      lang,
      isRTL,
      t: DICTIONARIES[lang],
      setLanguage,
      ready,
      tp: (template, values) =>
        Object.entries(values).reduce(
          (text, [key, val]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val)),
          template,
        ),
    };
  }, [lang, ready, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n يجب أن يُستخدم داخل I18nProvider');
  return context;
}
