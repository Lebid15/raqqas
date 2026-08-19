import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { api } from '../api/client';
import type { NotificationItem, Paginated } from '../api/types';
import { SubHeader } from '../components/Header';
import { Empty, Loader, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const ICONS: Record<string, string> = {
  listing_published: '✅',
  listing_rejected: '✏️',
  listing_expiring: '⏳',
  listing_expired: '📭',
  new_pending: '🔔',
  account: '👤',
  system: '📣',
};

export function NotificationsScreen({ navigation }: Props) {
  const t = useTheme();
  const { t: text } = useI18n();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const page = await api.get<Paginated<NotificationItem>>('/notifications', { page_size: 40 });
      setItems(page.results);
      // فتح الشاشة يعني أن المستخدم رآها
      if (page.unread) await api.post('/notifications/read', {});
    } catch {
      /* بلا إنترنت */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SubHeader title={text.notifications.title} onBack={() => navigation.goBack()} />

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Empty icon="🔔" title={text.notifications.empty} text={text.notifications.emptyText} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={t.colors.brand}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                item.listing_id ? navigation.navigate('Listing', { id: item.listing_id }) : undefined
              }
              style={({ pressed }) => [
                t.row,
                {
                  gap: 12,
                  padding: t.sp(13),
                  backgroundColor: item.is_read ? t.colors.surface : t.colors.brand50,
                  borderWidth: 1,
                  borderColor: t.colors.line,
                  borderRadius: t.radius.md,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Txt size={22}>{ICONS[item.kind] ?? '📣'}</Txt>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={14} weight={800} align="start">
                  {item.title}
                </Txt>
                {item.body ? (
                  <Txt size={12.5} weight={600} color={t.colors.ink2} align="start" numberOfLines={3}>
                    {item.body}
                  </Txt>
                ) : null}
                <Txt size={11} weight={600} muted align="start">
                  {item.time_text}
                </Txt>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
