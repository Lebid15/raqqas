import React, { useState } from 'react';
import { Linking, Modal, Platform, View } from 'react-native';

import { APP_VERSION, CAN_DOWNLOAD_APK, PLAY_STORE_URL } from '../config';
import { useI18n } from '../i18n';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Txt } from './ui';

/**
 * فحص الإصدار — بديلنا عن التحديث التلقائي في المتجر (plan2 §7.2).
 *
 *   الإصدار أقدم من min_version  → شاشة إجبارية لا يُستخدم التطبيق قبل التحديث
 *   الإصدار أقدم من latest       → لافتة يمكن تأجيلها
 *
 * ⚠️ فرق جوهري بين قناتَي التوزيع (config.ts → DISTRIBUTION):
 *
 *   · نسخة الموقع (direct) → زرّ يفتح رابط ملف APK. هذا سلوك طبيعي خارج المتجر.
 *   · نسخة المتجر (play)   → زرّ يفتح صفحة التطبيق في Google Play، **ولا يلمس
 *     ملف APK إطلاقًا**. تنزيل حزمة تثبيت من خارج المتجر داخل تطبيق منشور فيه
 *     مخالفة صريحة لسياسة «إساءة استخدام الجهاز والشبكة»، وعقوبتها إزالة
 *     التطبيق لا مجرّد رفض التحديث.
 *
 * والشرط `CAN_DOWNLOAD_APK` ثابت وقت البناء لا قيمة من الخادم — فحزمة المتجر
 * لا تحوي مسار التنزيل في كودها أصلًا، وهذا ما يفحصه المراجع.
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const { config, updateState } = useAppConfig();
  const [dismissed, setDismissed] = useState(false);

  const required = updateState === 'required';
  const available = updateState === 'available' && !dismissed;

  /** رابط صفحة التطبيق في المتجر — من اللوحة إن ضُبط، وإلا من معرّف الحزمة. */
  const storeUrl = config.app.store_url || PLAY_STORE_URL;

  const openUpdate = () => {
    if (CAN_DOWNLOAD_APK) {
      if (config.app.apk_url) void Linking.openURL(config.app.apk_url);
      return;
    }
    // `market://` يفتح تطبيق المتجر مباشرة؛ وإن لم يكن مثبَّتًا نرجع للمتصفّح.
    const marketUrl = storeUrl.replace(
      'https://play.google.com/store/apps/details',
      'market://details',
    );
    if (Platform.OS === 'android') {
      Linking.openURL(marketUrl).catch(() => Linking.openURL(storeUrl));
      return;
    }
    void Linking.openURL(storeUrl);
  };

  const actionLabel = CAN_DOWNLOAD_APK ? text.update.download : text.update.openStore;

  return (
    <>
      {children}

      {available ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: t.colors.gold,
            paddingTop: 44,
            paddingBottom: 10,
            paddingHorizontal: 14,
            flexDirection: t.isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Txt size={13} weight={800} color={t.colors.onGold} style={{ flex: 1 }} align="start">
            ⬇️ {tp(text.update.availableText, { version: config.app.latest_version })}
          </Txt>
          <Button title={actionLabel} size="sm" variant="ghost" onPress={openUpdate} />
          <Button title={text.update.later} size="sm" variant="ghost" onPress={() => setDismissed(true)} />
        </View>
      ) : null}

      <Modal visible={required} animationType="fade" transparent={false}>
        <View
          style={{
            flex: 1,
            backgroundColor: t.colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
            gap: 12,
          }}
        >
          <Txt size={64}>⬇️</Txt>
          <Txt size={22} weight={900} color="#FFFFFF" align="center">
            {text.update.requiredTitle}
          </Txt>
          <Txt size={14} color="rgba(255,255,255,0.85)" align="center" style={{ lineHeight: 24 }}>
            {config.app.update_message || text.update.requiredText}
          </Txt>
          <Txt size={12} color="rgba(255,255,255,0.6)">
            {APP_VERSION ?? '—'} → {config.app.latest_version}
          </Txt>
          <View style={{ marginTop: 12 }}>
            <Button title={actionLabel} variant="gold" size="lg" onPress={openUpdate} />
          </View>
        </View>
      </Modal>
    </>
  );
}
