import { Image } from 'expo-image';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';
import { OptionList, Sheet } from './Sheet';
import { IconButton, Txt } from './ui';

/**
 * الترويسة الرئيسية — مطابقة لـ .header في design/style.css:
 * خلفية بلون العلامة · مربّع الحرف · الاسم والوصف · أزرار · صف سفلي متغيّر.
 */
export function Header({
  variant = 'search',
  title,
  value,
  onChangeText,
  onSearchPress,
  onFilters,
  onBack,
  onNotifications,
  unreadCount = 0,
  autoFocus,
  right,
}: {
  variant?: 'search' | 'liveSearch' | 'title' | 'plain';
  title?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearchPress?: () => void;
  onFilters?: () => void;
  onBack?: () => void;
  onNotifications?: () => void;
  unreadCount?: number;
  autoFocus?: boolean;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const { t: text } = useI18n();
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();

  // الاسم والشعار من لوحة الإدارة، ونصّ الترجمة المدمج شبكة أمان حين لا تصل الإعدادات
  const brand = config.brand;
  const brandName = brand?.name || text.brand.name;
  const brandMark = brand?.mark || text.brand.mark;

  const backButton = onBack ? (
    <IconButton
      icon={t.isRTL ? '→' : '←'}
      size={34}
      color="#FFFFFF"
      background="rgba(255,255,255,0.16)"
      onPress={onBack}
    />
  ) : null;

  return (
    <View
      style={{
        backgroundColor: t.colors.brand,
        paddingTop: insets.top,
        ...t.shadow('sm'),
      }}
    >
      <View
        style={[
          t.row,
          { alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
        ]}
      >
        <View style={[t.row, { alignItems: 'center', gap: 9, flex: 1 }]}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {brand?.logo ? (
              <Image
                source={{ uri: brand.logo }}
                style={{ width: '100%', height: '100%', borderRadius: 11 }}
                contentFit="cover"
              />
            ) : (
              <Txt size={19} weight={900} color={t.colors.brand}>
                {brandMark}
              </Txt>
            )}
          </View>
          <View>
            <Txt size={17} weight={900} color="#FFFFFF" align="start">
              {brandName}
            </Txt>
            <Txt size={10.5} weight={600} color="rgba(255,255,255,0.82)" align="start">
              {text.brand.tagline}
            </Txt>
          </View>
        </View>

        {right}

        <CurrencySwitch />

        {onNotifications ? (
          <View>
            <IconButton icon="🔔" color="#FFFFFF" onPress={onNotifications} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  [t.isRTL ? 'left' : 'right']: 4,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 4,
                  borderRadius: t.radius.full,
                  backgroundColor: t.colors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt size={10} weight={900} color={t.colors.onGold}>
                  {unreadCount > 9 ? '9+' : String(unreadCount)}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {variant === 'search' ? (
        <View
          style={[t.row, { gap: 8, paddingHorizontal: 14, paddingBottom: 12, alignItems: 'center' }]}
        >
          <Pressable onPress={onSearchPress} style={{ flex: 1 }}>
            <SearchBarShell>
              <Txt size={14.5} color={t.colors.ink3} style={{ flex: 1 }} align="start">
                {text.common.search}
              </Txt>
            </SearchBarShell>
          </Pressable>

          {/*
            زر المرشّحات بجانب البحث لا داخله.
            كان مخبّأً خلف شاشة البحث فلم يجده أحد — والفلترة بالسعر والحي
            من أكثر ما يستعمله الناس في سوق محلّي.
          */}
          {onFilters ? (
            <Pressable
              onPress={onFilters}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: t.radius.full,
                backgroundColor: t.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Txt size={18} color={t.colors.brandText}>
                ⚙
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {variant === 'liveSearch' ? (
        <View
          style={[t.row, { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12 }]}
        >
          {backButton}
          <View style={{ flex: 1 }}>
            <SearchBarShell>
              <TextInput
                value={value}
                onChangeText={onChangeText}
                autoFocus={autoFocus}
                placeholder={text.common.search}
                placeholderTextColor={t.colors.ink3}
                returnKeyType="search"
                style={[
                  t.font(400),
                  {
                    flex: 1,
                    fontSize: t.fs(14.5),
                    color: t.colors.ink,
                    padding: 0,
                    textAlign: t.isRTL ? 'right' : 'left',
                  },
                ]}
              />
              {value ? (
                <Pressable onPress={() => onChangeText?.('')} hitSlop={8}>
                  <Txt size={13} muted>
                    ✕
                  </Txt>
                </Pressable>
              ) : null}
            </SearchBarShell>
          </View>
        </View>
      ) : null}

      {variant === 'title' ? (
        <View
          style={[t.row, { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 11 }]}
        >
          {backButton}
          <Txt size={16.5} weight={800} color="#FFFFFF" style={{ flex: 1 }} align="start">
            {title}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}


/**
 * مُبدّل العملة — أيقونة في الترويسة تظهر رمز العملة التي يقرأ بها المستخدم.
 *
 * موضعها في الترويسة لا في الإعدادات عن قصد: في سوق تتقلّب فيه العملات
 * يبدّل المستخدم عملته وهو يتصفّح، لا مرّة واحدة عند التثبيت. والتبديل هنا
 * فوري بلا أي طلب شبكة — كل الأسعار محسوبة على الجهاز (lib/money.ts).
 */
function CurrencySwitch() {
  const t = useTheme();
  const { t: text } = useI18n();
  const { config, currency, setCurrency } = useAppConfig();
  const [open, setOpen] = React.useState(false);

  const options = config.currency.catalogue;
  // عملة واحدة متاحة = لا خيار = لا زرّ. زرٌّ لا يفعل شيئًا أسوأ من غيابه.
  if (options.length < 2) return null;

  const symbol = options.find((c) => c.code === currency)?.symbol ?? currency;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={text.common.currency}
        style={({ pressed }) => ({
          minWidth: 38,
          height: 34,
          paddingHorizontal: 9,
          borderRadius: t.radius.full,
          backgroundColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Txt size={13.5} weight={900} color="#FFFFFF">
          {symbol}
        </Txt>
      </Pressable>

      <Sheet visible={open} title={text.common.currency} onClose={() => setOpen(false)}>
        <OptionList
          options={options.map((c) => ({
            value: c.code,
            label: `${c.name} · ${c.symbol}`,
          }))}
          value={currency}
          onChange={(value) => {
            void setCurrency(value);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

function SearchBarShell({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        t.row,
        {
          alignItems: 'center',
          gap: 9,
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.full,
          paddingHorizontal: 16,
          paddingVertical: 11,
        },
      ]}
    >
      <Txt size={16}>🔎</Txt>
      {children}
    </View>
  );
}

/** ترويسة داخلية فاتحة — .subheader في التصميم (شاشات فرعية). */
export function SubHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.line,
        paddingTop: insets.top,
      }}
    >
      <View
        style={[
          t.row,
          {
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            minHeight: t.sizes.headerHeight,
          },
        ]}
      >
        {onBack ? <IconButton icon={t.isRTL ? '→' : '←'} onPress={onBack} /> : null}
        <Txt size={16.5} weight={800} style={{ flex: 1 }} align="start" numberOfLines={1}>
          {title}
        </Txt>
        {right}
      </View>
    </View>
  );
}
