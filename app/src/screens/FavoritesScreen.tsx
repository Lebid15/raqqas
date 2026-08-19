import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { api } from '../api/client';
import type { ListingCard, Paginated } from '../api/types';
import { AdRow } from '../components/AdCard';
import { Header } from '../components/Header';
import { Empty, Loader, Notice } from '../components/ui';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { useFavorites } from '../state/FavoritesContext';
import { useTheme } from '../theme/ThemeProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * المفضلة.
 *
 * الزائر يرى مفضلته المحفوظة على جهازه (نجلب تفاصيلها بمعرّفاتها)،
 * والمسجَّل يراها من حسابه. الاختلاف في المصدر فقط — الشاشة واحدة.
 */
export function FavoritesScreen() {
  const t = useTheme();
  const { t: text } = useI18n();
  const navigation = useNavigation<Nav>();
  const { isAuthenticated } = useAuth();
  const favorites = useFavorites();

  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ids = Array.from(favorites.ids);
  const idsKey = ids.join(',');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        if (isAuthenticated) {
          const page = await api.get<Paginated<ListingCard>>('/favorites', { page_size: 60 });
          setItems(page.results);
        } else if (ids.length === 0) {
          setItems([]);
        } else {
          // الزائر: نجلب الإعلانات المحفوظة محليًا ونرتّبها كترتيب الحفظ
          const page = await api.get<Paginated<ListingCard>>('/listings', {
            page_size: 60,
          });
          const byId = new Map(page.results.map((item) => [item.id, item]));
          setItems(ids.map((id) => byId.get(id)).filter(Boolean) as ListingCard[]);
        }
      } catch {
        /* بلا إنترنت — نبقى على ما هو معروض */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, idsKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Header variant="title" title={`❤ ${text.favorites.title}`} />

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Empty
          icon="💔"
          title={text.favorites.empty}
          text={text.favorites.emptyText}
          action={text.nav.home}
          onAction={() => navigation.navigate('Tabs')}
        />
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
          ListHeaderComponent={
            !isAuthenticated ? (
              <View style={{ marginBottom: 12 }}>
                <Notice tone="info">{text.favorites.guestNote}</Notice>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <AdRow listing={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />
          )}
        />
      )}
    </View>
  );
}
