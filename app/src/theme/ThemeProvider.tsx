import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import { STORAGE } from '../config';
import { useI18n } from '../i18n';
import { useAppConfig } from '../state/AppConfigContext';
import {
  DENSITY_SCALE,
  RADIUS,
  SIZES,
  shadow as buildShadow,
  type ColorTokens,
  type RadiusTokens,
} from './tokens';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type Theme = {
  colors: ColorTokens;
  radius: RadiusTokens;
  sizes: typeof SIZES;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  darkModeEnabled: boolean;

  /** حجم نصّ مضروبًا بمقياس الخط من لوحة الإدارة. */
  fs: (size: number) => number;
  /** مسافة داخلية مضروبة بالكثافة. */
  sp: (size: number) => number;
  /** عائلة الخط للوزن المطلوب — RN لا يدعم fontWeight مع الخطوط المخصّصة. */
  font: (weight: 400 | 600 | 700 | 800 | 900) => TextStyle;
  shadow: (size: 'sm' | 'md' | 'lg') => ViewStyle;

  // اتجاه الكتابة — كل التخطيط منطقي (start/end) لا يمين/يسار (plan2 §5)
  isRTL: boolean;
  row: ViewStyle;
  rowReverse: ViewStyle;
  textStart: TextStyle;
  textEnd: TextStyle;
};

const ThemeContext = createContext<Theme | null>(null);

/**
 * أوزان Cairo المحزومة داخل التطبيق.
 * لا نحمّل خطوطًا من الإنترنت (plan2 §7): بطيء ويكسر التصميم بلا اتصال.
 */
const FONT_FAMILIES: Record<number, string> = {
  400: 'Cairo_400Regular',
  600: 'Cairo_600SemiBold',
  700: 'Cairo_700Bold',
  800: 'Cairo_800ExtraBold',
  900: 'Cairo_900Black',
};

export function ThemeProvider({
  children,
  fontsReady = true,
}: {
  children: React.ReactNode;
  /** حين تفشل حزمة Cairo أو تتأخّر، نعود لخط النظام بدل اسم خطّ غير موجود. */
  fontsReady?: boolean;
}) {
  const { config } = useAppConfig();
  const { isRTL } = useI18n();
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE.themeMode).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE.themeMode, next);
  }, []);

  const value = useMemo<Theme>(() => {
    const darkModeEnabled = config.theme.darkModeEnabled !== false;
    const resolved = !darkModeEnabled
      ? 'light'
      : mode === 'auto'
        ? (systemScheme ?? 'light')
        : mode;
    const isDark = resolved === 'dark';

    const colors = isDark ? config.theme.dark : config.theme.light;
    const radius = { ...RADIUS, ...config.theme.radius };
    const fontScale = config.theme.font?.scale ?? 1;
    const densityScale = DENSITY_SCALE[config.theme.density] ?? 1;
    const family = config.theme.font?.family ?? 'Cairo';

    return {
      colors,
      radius,
      sizes: SIZES,
      isDark,
      mode,
      setMode,
      darkModeEnabled,

      fs: (size) => Math.round(size * fontScale * 10) / 10,
      sp: (size) => Math.round(size * densityScale),
      font: (weight) => {
        const useBundled = fontsReady && family === 'Cairo';
        return {
          fontFamily: useBundled ? FONT_FAMILIES[weight] : undefined,
          fontWeight: useBundled ? undefined : (String(weight) as TextStyle['fontWeight']),
        };
      },
      shadow: (size) => buildShadow(config.theme.shadows, size, isDark) as ViewStyle,

      isRTL,
      row: { flexDirection: isRTL ? 'row-reverse' : 'row' },
      rowReverse: { flexDirection: isRTL ? 'row' : 'row-reverse' },
      textStart: { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
      textEnd: { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' },
    };
  }, [config.theme, fontsReady, isRTL, mode, setMode, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme يجب أن يُستخدم داخل ThemeProvider');
  return context;
}
