import React, { useState } from 'react';
import { Linking, Modal, View } from 'react-native';

import { APP_VERSION } from '../config';
import { useI18n } from '../i18n';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Txt } from './ui';

/**
 * فحص الإصدار — بديلنا عن التحديث التلقائي في المتجر (plan2 §7.2).
 *
 *   الإصدار أقدم من min_version  → شاشة إجبارية لا يُستخدم التطبيق قبل التحديث
 *   الإصدار أقدم من latest       → لافتة يمكن تأجيلها
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const { config, updateState } = useAppConfig();
  const [dismissed, setDismissed] = useState(false);

  const required = updateState === 'required';
  const available = updateState === 'available' && !dismissed;

  const download = () => {
    if (config.app.apk_url) void Linking.openURL(config.app.apk_url);
  };

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
          <Button title={text.update.download} size="sm" variant="ghost" onPress={download} />
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
            <Button title={text.update.download} variant="gold" size="lg" onPress={download} />
          </View>
        </View>
      </Modal>
    </>
  );
}
