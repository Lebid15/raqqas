import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { api, ApiError } from '../api/client';
import { Field, Input } from '../components/Field';
import { SubHeader } from '../components/Header';
import { KeyboardScroll } from '../components/KeyboardScroll';
import { useToast } from '../components/Toast';
import { Button, Card, Notice, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import { useAppConfig } from '../state/AppConfigContext';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../theme/ThemeProvider';

/**
 * حذف الحساب — شاشة مستقلّة عن قصد.
 *
 * سياسة «حذف بيانات المستخدم» في Google Play تشترط مسارًا **داخل التطبيق**
 * يحذف الحساب فعلًا لا يعطّله، وأن يكون واضحًا لا مخبّأً خلف مراسلة الدعم.
 * وضعناه شاشة كاملة لا نافذة صغيرة: القرار نهائي ولا يصحّ أن يُتخذ بضغطة
 * عابرة، والمستخدم يقرأ هنا بالضبط ما الذي سيُحذف قبل أن يكتب كلمة مروره.
 */
export function DeleteAccountScreen() {
  const t = useTheme();
  const { t: text } = useI18n();
  const navigation = useNavigation();
  const toast = useToast();
  const { logout } = useAuth();
  const { config } = useAppConfig();

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/me/delete', { password });
      // الحساب لم يعد موجودًا على الخادم — ننظّف الجهاز فورًا حتى لا يبقى
      // رمز دخول ميّت يسبّب أخطاء غامضة في أول طلب قادم.
      await logout();
      toast.show(text.account.deleteDone);
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : text.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SubHeader title={text.account.deleteTitle} />
      <KeyboardScroll contentContainerStyle={{ padding: 14, gap: 14 }}>
        <Notice tone="danger">{text.account.deleteWarn}</Notice>

        <Card>
          <Field label={text.account.deleteConfirmLabel}>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
            />
          </Field>
          {error ? (
            <Txt size={13} weight={700} color={t.colors.danger} align="start">
              {error}
            </Txt>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <Button
              title={text.account.deleteButton}
              variant="danger"
              size="lg"
              block
              loading={busy}
              disabled={password.length < 1}
              onPress={submit}
            />
          </View>
        </Card>

        {config.legal.delete_account ? (
          <View style={{ gap: 6 }}>
            <Txt size={12.5} muted align="start">
              {text.account.deleteWeb}
            </Txt>
            <Pressable onPress={() => void Linking.openURL(config.legal.delete_account)}>
              <Txt size={12.5} weight={700} color={t.colors.brandText} align="start">
                {config.legal.delete_account}
              </Txt>
            </Pressable>
          </View>
        ) : null}
      </KeyboardScroll>
    </View>
  );
}
