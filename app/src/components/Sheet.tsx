import React from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from './KeyboardScroll';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton, Txt } from './ui';

/** نافذة سفلية — مطابقة لـ .sheet في design/style.css */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(8,18,14,0.5)' }}
      />
      <View
        style={{
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: t.radius.xl,
          borderTopRightRadius: t.radius.xl,
          // ارتفاع محسوب لا نسبة مئوية: مع رفع النافذة فوق لوحة المفاتيح،
          // كانت «86%» تعني 86% من الشاشة **فوق** اللوحة — فيخرج العنوان
          // وزرّ الإغلاق من أعلى الشاشة ولا يجد المستخدم كيف يُغلقها.
          maxHeight: Math.max(220, windowHeight * 0.86 - keyboard),
          // النافذة ملتصقة بأسفل الشاشة، فلوحة المفاتيح تغطّيها كاملة. نرفعها
          // بارتفاعها فتبقى الحقول (نطاق السعر · نصّ البلاغ) فوقها ومرئية.
          // ومع edge-to-edge في أندرويد الحديث لا يقلّص النظام النافذة عنّا.
          marginBottom: keyboard,
          paddingBottom: keyboard ? 0 : insets.bottom,
          ...t.shadow('lg'),
        }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: t.radius.full,
            backgroundColor: t.colors.line,
            alignSelf: 'center',
            marginTop: 9,
            marginBottom: 4,
          }}
        />
        <View
          style={[
            t.row,
            {
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.line,
            },
          ]}
        >
          <Txt size={16} weight={800} style={{ flex: 1 }} align="start">
            {title}
          </Txt>
          <IconButton icon="✕" size={32} onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        {footer ? (
          <View
            style={[
              t.row,
              {
                gap: 9,
                padding: 12,
                paddingBottom: 14,
                borderTopWidth: 1,
                borderTopColor: t.colors.line,
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** قائمة خيارات داخل نافذة سفلية — .opt-list في التصميم */
export function OptionList<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              t.row,
              {
                alignItems: 'center',
                gap: 11,
                paddingVertical: 13,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: t.colors.line,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: t.radius.full,
                borderWidth: 2,
                borderColor: selected ? t.colors.brandText : t.colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: t.radius.full,
                    backgroundColor: t.colors.brandText,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={14.5} weight={700} align="start">
                {option.label}
              </Txt>
              {option.hint ? (
                <Txt size={11.5} muted align="start">
                  {option.hint}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
