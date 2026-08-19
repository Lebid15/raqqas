import React from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useKeyboardScroll } from './KeyboardScroll';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './ui';

/* ------------------------------------------------------------------ الحقل */

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.sp(16) }}>
      {label ? (
        <View style={[t.row, { alignItems: 'center', gap: 6, marginBottom: 7 }]}>
          <Txt size={13.5} weight={800} align="start">
            {label}
          </Txt>
          {required ? (
            <Txt size={13.5} weight={800} color={t.colors.danger}>
              *
            </Txt>
          ) : null}
          {optional ? (
            <Txt size={11.5} weight={600} muted>
              ({optional})
            </Txt>
          ) : null}
        </View>
      ) : null}

      {children}

      {error ? (
        <Txt size={11.5} weight={600} color={t.colors.danger} align="start" style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={11.5} weight={600} muted align="start" style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ الإدخال */

type InputProps = TextInputProps & {
  invalid?: boolean;
  ltr?: boolean;
  /**
   * حقل كلمة مرور: يضيف أيقونة إظهار/إخفاء، ويهيّئ الحفظ التلقائي.
   *
   * لم نكتفِ بـ`secureTextEntry` المجرّدة لأن كتابة كلمة مرور بلا رؤيتها على
   * لوحة مفاتيح جوال مصدر أخطاء متكرّر — خصوصًا مع تبديل اللغة.
   */
  password?: 'current' | 'new';
};

export function Input({ invalid, ltr, style, password, ...rest }: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const keyboardScroll = useKeyboardScroll();

  const isPassword = Boolean(password);

  /*
   * تلميحات الحفظ التلقائي.
   *
   * أندرويد لا يعرض «هل تحفظ كلمة المرور؟» إلا حين يفهم دور الحقل. وتمييز
   * `new-password` عن `password` ليس تجميلًا: بلا التمييز يعرض مدير كلمات
   * المرور كلمةً قديمة في شاشة «حساب جديد» بدل أن يقترح واحدة قوية.
   */
  const autoFill: TextInputProps = isPassword
    ? {
        secureTextEntry: !revealed,
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: password === 'new' ? 'new-password' : 'password',
        textContentType: password === 'new' ? 'newPassword' : 'password',
        importantForAutofill: 'yes',
      }
    : {};

  const field = (
    <TextInput
      {...autoFill}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        // نُعلم مساحة التمرير فوقنا لتضمن ظهور هذا الحقل. لا يكفي حدث ظهور
        // اللوحة: الانتقال من حقل إلى آخر لا يُطلقه، واللوحة مفتوحة أصلًا.
        keyboardScroll?.onFieldFocus();
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      placeholderTextColor={t.colors.ink3}
      style={[
        t.font(400),
        {
          backgroundColor: t.colors.surface,
          borderWidth: 1.5,
          borderColor: invalid ? t.colors.danger : focused ? t.colors.brand : t.colors.line,
          borderRadius: t.radius.md,
          paddingHorizontal: t.sp(14),
          paddingVertical: t.sp(12),
          // مساحة للأيقونة حتى لا يمرّ النصّ الطويل تحتها
          paddingEnd: isPassword ? t.sp(48) : undefined,
          fontSize: t.fs(14.5),
          color: t.colors.ink,
          textAlign: ltr ? 'left' : t.isRTL ? 'right' : 'left',
          writingDirection: ltr ? 'ltr' : t.isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
    />
  );

  if (!isPassword) return field;

  return (
    <View>
      {field}
      <Pressable
        onPress={() => setRevealed((value) => !value)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          // نهاية الحقل لا يمينه: الشاشة تنقلب مع اللغة
          [t.isRTL ? 'left' : 'right']: 0,
          width: t.sp(46),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt size={17}>{revealed ? '🙈' : '👁️'}</Txt>
      </Pressable>
    </View>
  );
}

export function TextArea(props: InputProps) {
  const t = useTheme();
  return (
    <Input
      {...props}
      multiline
      textAlignVertical="top"
      style={[{ minHeight: t.sp(110), lineHeight: t.fs(24) }, props.style]}
    />
  );
}

/* ------------------------------------------------------------------ زر اختيار */

/** يفتح نافذة سفلية — يحلّ محلّ <select> الذي لا وجود له في React Native. */
export function SelectButton({
  value,
  placeholder,
  onPress,
  invalid,
  icon,
}: {
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  invalid?: boolean;
  icon?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        t.row,
        {
          alignItems: 'center',
          gap: 8,
          backgroundColor: t.colors.surface,
          borderWidth: 1.5,
          borderColor: invalid ? t.colors.danger : t.colors.line,
          borderRadius: t.radius.md,
          paddingHorizontal: t.sp(14),
          paddingVertical: t.sp(12),
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? <Txt size={16}>{icon}</Txt> : null}
      <Txt
        size={14.5}
        color={value ? t.colors.ink : t.colors.ink3}
        style={{ flex: 1 }}
        align="start"
        numberOfLines={1}
      >
        {value || placeholder}
      </Txt>
      <Txt size={12} muted>
        {t.isRTL ? '‹' : '›'}
      </Txt>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ مجموعة اختيار */

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[t.row, { gap: 8, flexWrap: 'wrap' }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              t.row,
              {
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: t.sp(18),
                paddingVertical: t.sp(10),
                borderRadius: t.radius.md,
                borderWidth: 1.5,
                borderColor: active ? t.colors.brand : t.colors.line,
                backgroundColor: active ? t.colors.brand50 : t.colors.surface,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {option.icon ? <Txt size={14}>{option.icon}</Txt> : null}
            <Txt size={14} weight={700} color={active ? t.colors.brandText : t.colors.ink}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
