import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/* ------------------------------------------------------------------ النصّ */

type Weight = 400 | 600 | 700 | 800 | 900;

type TxtProps = TextProps & {
  size?: number;
  weight?: Weight;
  color?: string;
  align?: 'start' | 'end' | 'center';
  muted?: boolean;
};

export function Txt({
  size = 14,
  weight = 400,
  color,
  align,
  muted,
  style,
  ...rest
}: TxtProps) {
  const t = useTheme();
  const alignStyle: TextStyle | undefined =
    align === 'center'
      ? { textAlign: 'center' }
      : align === 'end'
        ? t.textEnd
        : align === 'start'
          ? t.textStart
          : undefined;

  return (
    <Text
      {...rest}
      style={[
        t.font(weight),
        { fontSize: t.fs(size), color: color ?? (muted ? t.colors.ink3 : t.colors.ink) },
        alignStyle,
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ الأزرار */

export type ButtonVariant = 'primary' | 'gold' | 'danger' | 'success' | 'ghost' | 'soft' | 'onBrand';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  block,
  icon,
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const t = useTheme();

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.colors.brand, fg: t.colors.onBrand, border: 'transparent' },
    gold: { bg: t.colors.gold, fg: t.colors.onGold, border: 'transparent' },
    danger: { bg: t.colors.danger, fg: '#FFFFFF', border: 'transparent' },
    success: { bg: t.colors.success, fg: '#FFFFFF', border: 'transparent' },
    ghost: { bg: t.colors.surface, fg: t.colors.ink, border: t.colors.line },
    soft: { bg: t.colors.brand50, fg: t.colors.brandText, border: 'transparent' },
    onBrand: { bg: 'rgba(255,255,255,0.18)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.3)' },
  };

  const metrics = {
    sm: { padV: 7, padH: 12, font: 12.5, radius: t.radius.sm },
    md: { padV: 11, padH: 18, font: 14.5, radius: t.radius.md },
    lg: { padV: 14, padH: 22, font: 16, radius: t.radius.md },
  }[size];

  const { bg, fg, border } = palette[variant];

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        t.row,
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          borderRadius: metrics.radius,
          paddingVertical: t.sp(metrics.padV),
          paddingHorizontal: t.sp(metrics.padH),
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          alignSelf: block ? 'stretch' : 'flex-start',
          width: block ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Txt size={metrics.font} color={fg}>{icon}</Txt> : null}
          <Txt size={metrics.font} weight={800} color={fg}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** زر أيقونة دائري — الترويسة وبطاقات الإعلانات. */
export function IconButton({
  icon,
  size = 38,
  color,
  background,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  icon: string;
  size?: number;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      {...rest}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: t.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background ?? 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Txt size={size * 0.45} color={color ?? t.colors.ink2}>
        {icon}
      </Txt>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ الحاويات */

export function Card({ style, children, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.line,
          borderWidth: 1,
          borderRadius: t.radius.md,
          padding: t.sp(14),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.sp(22) }}>
      <View
        style={[
          t.row,
          { alignItems: 'center', justifyContent: 'space-between', marginBottom: t.sp(12), gap: 10 },
        ]}
      >
        <Txt size={17} weight={800}>
          {title}
        </Txt>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Txt size={13} weight={700} color={t.colors.brandText}>
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ الشارات */

export function Badge({
  label,
  background,
  color,
  size = 10.5,
}: {
  label: string;
  background: string;
  color: string;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: background,
        borderRadius: t.radius.full,
        paddingHorizontal: 9,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Txt size={size} weight={800} color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const t = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    pending: { bg: t.colors.gold50, fg: t.isDark ? t.colors.gold : '#8A5A00' },
    published: { bg: t.colors.success50, fg: t.colors.success },
    rejected: { bg: t.colors.danger50, fg: t.colors.danger },
    expired: { bg: t.colors.bg, fg: t.colors.ink3 },
    suspended: { bg: t.colors.bg, fg: t.colors.ink2 },
    draft: { bg: t.colors.bg, fg: t.colors.ink3 },
  };
  const colors = map[status] ?? { bg: t.colors.bg, fg: t.colors.ink3 };
  return <Badge label={label} background={colors.bg} color={colors.fg} size={11} />;
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: t.sp(15),
        paddingVertical: t.sp(8),
        borderRadius: t.radius.full,
        backgroundColor: active ? t.colors.brand : t.colors.surface,
        borderWidth: 1,
        borderColor: active ? t.colors.brand : t.colors.line,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt size={13} weight={700} color={active ? t.colors.onBrand : t.colors.ink2}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Avatar({
  initial,
  size = 46,
  background,
  color,
}: {
  initial: string;
  size?: number;
  background?: string;
  color?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.full,
        backgroundColor: background ?? t.colors.brand50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={size * 0.39} weight={900} color={color ?? t.colors.brandText}>
        {initial}
      </Txt>
    </View>
  );
}

/* ------------------------------------------------------------------ التنبيهات */

export type NoticeTone = 'info' | 'warn' | 'success' | 'danger';

export function Notice({
  tone = 'info',
  icon,
  children,
}: {
  tone?: NoticeTone;
  icon?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const map: Record<NoticeTone, { bg: string; fg: string; icon: string }> = {
    info: { bg: t.colors.info50, fg: t.colors.info, icon: 'ℹ️' },
    warn: { bg: t.colors.gold50, fg: t.isDark ? t.colors.gold : '#8A5A00', icon: '⚠️' },
    success: { bg: t.colors.success50, fg: t.colors.success, icon: '✅' },
    danger: { bg: t.colors.danger50, fg: t.colors.danger, icon: '⛔' },
  };
  const style = map[tone];

  return (
    <View
      style={[
        t.row,
        {
          gap: 10,
          padding: t.sp(12),
          borderRadius: t.radius.md,
          backgroundColor: style.bg,
        },
      ]}
    >
      <Txt size={17}>{icon ?? style.icon}</Txt>
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Txt size={13} weight={600} color={style.fg} align="start" style={{ lineHeight: 21 }}>
            {children}
          </Txt>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.sp(48), paddingHorizontal: 20 }}>
      <Txt size={52} style={{ opacity: 0.55, marginBottom: 10 }}>
        {icon}
      </Txt>
      <Txt size={16} weight={800} align="center" style={{ marginBottom: 5 }}>
        {title}
      </Txt>
      {text ? (
        <Txt size={13.5} muted align="center" style={{ marginBottom: 18, lineHeight: 22 }}>
          {text}
        </Txt>
      ) : null}
      {action ? <Button title={action} onPress={onAction} /> : null}
    </View>
  );
}

export function Loader({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ paddingVertical: 40, alignItems: 'center' }, style]}>
      <ActivityIndicator color={t.colors.brandText} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.colors.line }, style]} />;
}

export const styles = StyleSheet.create({
  container: { paddingHorizontal: 14 },
});
