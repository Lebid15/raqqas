import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './ui';

/** التنبيه العائم — مطابق لـ .toast في design/style.css */

type ToastValue = { show: (message: string) => void };

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(14)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      if (timer.current) clearTimeout(timer.current);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translate, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translate, { toValue: 14, duration: 200, useNativeDriver: true }),
        ]).start(() => setMessage(null));
      }, 2400);
    },
    [opacity, translate],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? <ToastBubble message={message} opacity={opacity} translate={translate} /> : null}
    </ToastContext.Provider>
  );
}

function ToastBubble({
  message,
  opacity,
  translate,
}: {
  message: string;
  opacity: Animated.Value;
  translate: Animated.Value;
}) {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: t.sizes.navHeight + 24,
          alignSelf: 'center',
          maxWidth: '90%',
          backgroundColor: t.colors.ink,
          paddingHorizontal: 20,
          paddingVertical: 11,
          borderRadius: t.radius.full,
          opacity,
          transform: [{ translateY: translate }],
          ...t.shadow('lg'),
        }}
      >
        <Txt size={13.5} weight={700} color={t.colors.bg} align="center">
          {message}
        </Txt>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast يجب أن يُستخدم داخل ToastProvider');
  return context;
}
