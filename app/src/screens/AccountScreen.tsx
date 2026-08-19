import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Lang } from '../api/types';
import { OptionList, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { Avatar, Button, Divider, Txt } from '../components/ui';
import { LANGUAGE_NAMES, useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { APP_VERSION } from '../config';
import { useAppConfig } from '../state/AppConfigContext';
import { useAuth } from '../state/AuthContext';
import { useFavorites } from '../state/FavoritesContext';
import { useTheme, type ThemeMode } from '../theme/ThemeProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AccountScreen() {
  const t = useTheme();
  const { t: text, tp, lang, setLanguage } = useI18n();
  const navigation = useNavigation<Nav>();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const { config } = useAppConfig();
  const favorites = useFavorites();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [sheet, setSheet] = useState<'language' | 'theme' | null>(null);

  const changeLanguage = async (next: Lang) => {
    await setLanguage(next);
    setSheet(null);
    if (isAuthenticated) {
      try {
        await updateProfile({ language: next });
      } catch {
        /* اللغة تعمل محليًا حتى لو تعذّر إخبار الخادم */
      }
    }
  };

  const confirmLogout = () => {
    Alert.alert(text.account.logout, text.account.logoutConfirm, [
      { text: text.common.cancel, style: 'cancel' },
      {
        text: text.account.logout,
        style: 'destructive',
        onPress: async () => {
          await logout();
          toast.show(text.auth.loggedOut);
        },
      },
    ]);
  };

  const themeLabels: Record<ThemeMode, string> = {
    auto: text.account.themeAuto,
    light: text.account.themeLight,
    dark: text.account.themeDark,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* الترويسة الملوّنة — .profile-head في التصميم */}
        <View
          style={{
            backgroundColor: t.colors.brand,
            paddingTop: insets.top + 20,
            paddingBottom: 26,
            paddingHorizontal: 14,
            alignItems: 'center',
          }}
        >
          <Avatar
            initial={user?.name?.trim()?.[0] ?? '👤'}
            size={72}
            background="rgba(255,255,255,0.2)"
            color="#FFFFFF"
          />
          <Txt size={18} weight={900} color="#FFFFFF" align="center" style={{ marginTop: 10 }}>
            {user?.name ?? text.account.guest}
          </Txt>
          {user ? (
            <Txt size={13} weight={600} color="rgba(255,255,255,0.85)" style={{ writingDirection: 'ltr' }}>
              {user.phone_display}
            </Txt>
          ) : (
            <Txt size={13} weight={600} color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 4 }}>
              {text.account.guestText}
            </Txt>
          )}
        </View>

        <View style={{ paddingHorizontal: 14 }}>
          {!isAuthenticated ? (
            <View style={{ marginTop: 16 }}>
              <Button
                title={text.auth.login}
                size="lg"
                block
                onPress={() => navigation.navigate('Auth', { reason: 'account' })}
              />
            </View>
          ) : (
            <View
              style={[
                t.row,
                {
                  marginTop: -18,
                  backgroundColor: t.colors.surface,
                  borderWidth: 1,
                  borderColor: t.colors.line,
                  borderRadius: t.radius.md,
                  ...t.shadow('md'),
                },
              ]}
            >
              <Stat value={user!.listings_approved_count} label={text.account.stats.listings} />
              <View style={{ width: 1, backgroundColor: t.colors.line }} />
              <Stat value={favorites.count} label={text.account.stats.favorites} />
            </View>
          )}

          {/* القائمة */}
          <Menu style={{ marginTop: 16 }}>
            {isAuthenticated ? (
              <>
                <MenuItem
                  icon="📋"
                  label={text.account.myListings}
                  onPress={() => navigation.navigate('MyListings')}
                />
                <MenuItem
                  icon="🔔"
                  label={text.account.notifications}
                  onPress={() => navigation.navigate('Notifications')}
                />
                <MenuItem
                  icon="✏️"
                  label={text.account.editProfile}
                  onPress={() => navigation.navigate('EditProfile')}
                />
              </>
            ) : null}
            <MenuItem
              icon="❤"
              label={text.account.favorites}
              value={String(favorites.count)}
              onPress={() => navigation.navigate('Tabs', { screen: 'FavoritesTab' } as never)}
            />
          </Menu>

          <Menu style={{ marginTop: 12 }}>
            <MenuItem
              icon="🌐"
              label={text.account.language}
              value={LANGUAGE_NAMES[lang]}
              onPress={() => setSheet('language')}
            />
            {config.theme.darkModeEnabled ? (
              <MenuItem
                icon={t.isDark ? '🌙' : '☀️'}
                label={text.account.theme}
                value={themeLabels[t.mode]}
                onPress={() => setSheet('theme')}
              />
            ) : null}
          </Menu>

          <Menu style={{ marginTop: 12 }}>
            {config.support.whatsapp ? (
              <MenuItem
                icon="💬"
                label={text.account.support}
                onPress={() =>
                  Linking.openURL(`https://wa.me/${config.support.whatsapp.replace(/\D/g, '')}`)
                }
              />
            ) : null}
            {config.legal.privacy ? (
              <MenuItem
                icon="🔒"
                label={text.account.privacy}
                onPress={() => void Linking.openURL(config.legal.privacy)}
              />
            ) : null}
            {config.legal.terms ? (
              <MenuItem
                icon="📄"
                label={text.account.terms}
                onPress={() => void Linking.openURL(config.legal.terms)}
              />
            ) : null}
            <MenuItem
              icon="ℹ️"
              label={text.account.about}
              value={tp(text.account.version, { version: APP_VERSION ?? '—' })}
            />
          </Menu>

          {isAuthenticated ? (
            <Menu style={{ marginTop: 12 }}>
              <MenuItem
                icon="🚫"
                label={text.account.blocked}
                onPress={() => navigation.navigate('Blocked')}
              />
              <MenuItem icon="🚪" label={text.account.logout} danger onPress={confirmLogout} />
              {/* حذف الحساب — مسار إلزامي في Google Play، وواضح لا مخبّأ */}
              <MenuItem
                icon="🗑️"
                label={text.account.deleteAccount}
                danger
                onPress={() => navigation.navigate('DeleteAccount')}
              />
            </Menu>
          ) : null}
        </View>
      </ScrollView>

      <Sheet visible={sheet === 'language'} title={text.account.language} onClose={() => setSheet(null)}>
        <OptionList
          options={config.languages.supported.map((code) => ({
            value: code,
            label: LANGUAGE_NAMES[code],
          }))}
          value={lang}
          onChange={(value) => void changeLanguage(value as Lang)}
        />
      </Sheet>

      <Sheet visible={sheet === 'theme'} title={text.account.theme} onClose={() => setSheet(null)}>
        <OptionList
          options={(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => ({
            value: mode,
            label: themeLabels[mode],
          }))}
          value={t.mode}
          onChange={(value) => {
            t.setMode(value as ThemeMode);
            setSheet(null);
          }}
        />
      </Sheet>
    </View>
  );
}

/* ------------------------------------------------------------------ عناصر */

function Stat({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Txt size={19} weight={900} color={t.colors.brandText}>
        {value}
      </Txt>
      <Txt size={11.5} weight={700} muted>
        {label}
      </Txt>
    </View>
  );
}

function Menu({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.line,
          borderRadius: t.radius.md,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child, index) => (
          <View key={index}>
            {index > 0 ? <Divider /> : null}
            {child}
          </View>
        ))}
    </View>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        t.row,
        {
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: t.sp(14),
          paddingVertical: t.sp(13),
          backgroundColor: pressed ? t.colors.surface2 : 'transparent',
        },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: t.radius.sm,
          backgroundColor: danger ? t.colors.danger50 : t.colors.brand50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt size={17}>{icon}</Txt>
      </View>
      <Txt
        size={14.5}
        weight={700}
        color={danger ? t.colors.danger : t.colors.ink}
        style={{ flex: 1 }}
        align="start"
      >
        {label}
      </Txt>
      {value ? (
        <Txt size={12.5} weight={700} muted>
          {value}
        </Txt>
      ) : null}
      {onPress ? (
        <Txt size={15} muted>
          {t.isRTL ? '‹' : '›'}
        </Txt>
      ) : null}
    </Pressable>
  );
}
