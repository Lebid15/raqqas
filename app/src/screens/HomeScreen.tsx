import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import type { Category, HomePayload } from '../api/types';
import { AdCard } from '../components/AdCard';
import { Header } from '../components/Header';
import { useToast } from '../components/Toast';
import { Card, Empty, Loader, Notice, Section, Txt } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppConfig } from '../state/AppConfigContext';
import { useFavorites } from '../state/FavoritesContext';
import { useTheme } from '../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

export function HomeScreen({ navigation }: Props) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const { config } = useAppConfig();
  const toast = useToast();
  const favorites = useFavorites();

  const { data, loading, refreshing, error, stale, refresh } = useResource<HomePayload>('/home', {
    cacheKey: 'home',
  });

  // رسالة ترحيب بعد نقل مفضلة الزائر إلى الحساب
  useEffect(() => {
    if (favorites.mergedCount) {
      toast.show(tp(text.favorites.merged, { count: favorites.mergedCount }));
      favorites.clearMergedNotice();
    }
  }, [favorites, text.favorites.merged, toast, tp]);

  const openListing = (id: number) => navigation.navigate('Listing', { id });

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <Header onSearchPress={() => navigation.navigate('Search')} />
        <Loader />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <Header onSearchPress={() => navigation.navigate('Search')} />
        <Empty
          icon="📡"
          title={text.errors.offlineTitle}
          text={error ? text.errors.offlineEmpty : text.errors.generic}
          action={text.common.retry}
          onAction={refresh}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Header
        onSearchPress={() => navigation.navigate('Search')}
        onFilters={() => navigation.navigate('Search', { openFilters: true })}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.brand} />
        }
      >
        {stale ? (
          <View style={{ marginTop: 12 }}>
            <Notice tone="warn">{text.errors.offlineText}</Notice>
          </View>
        ) : null}

        {/* الأقسام */}
        <Section
          title={`📂 ${text.home.categories}`}
          action={`${text.common.showAll} ‹`}
          onAction={() => navigation.navigate('Tabs', { screen: 'CategoriesTab' } as never)}
        >
          <CategoryRow
            categories={data.categories}
            onPress={(category) =>
              navigation.navigate('Search', {
                category: category.slug,
                categoryName: category.name,
              })
            }
          />
        </Section>

        {/* المميّزة */}
        {data.featured.length > 0 ? (
          <Section
            title={`🔥 ${text.home.featured}`}
            action={`${text.common.showAll} ‹`}
            onAction={() => navigation.navigate('Search', { featured: true })}
          >
            <FlatList
              horizontal
              data={data.featured}
              inverted={t.isRTL}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <AdCard listing={item} width={160} onPress={() => openListing(item.id)} />
              )}
            />
          </Section>
        ) : null}

        {/* بانر التمييز — يظهر فقط حين تُفعَّل الخدمة أو كإعلان قادم */}
        {!config.features.featured_enabled ? (
          <View style={{ marginTop: t.sp(22) }}>
            <Card style={{ backgroundColor: t.colors.gold50, borderColor: t.colors.gold }}>
              <View style={[t.row, { gap: 12, alignItems: 'center' }]}>
                <Txt size={30}>⭐</Txt>
                <View style={{ flex: 1 }}>
                  <Txt size={14.5} weight={800} align="start">
                    {text.home.featuredBannerTitle}
                  </Txt>
                  <Txt size={12.5} muted align="start">
                    {text.home.featuredBannerText}
                  </Txt>
                </View>
              </View>
            </Card>
          </View>
        ) : null}

        {/* الأحدث */}
        <Section
          title={`🆕 ${text.home.latest}`}
          action={`${text.common.showAll} ‹`}
          onAction={() => navigation.navigate('Search')}
        >
          {data.latest.length === 0 ? (
            <Empty icon="🗂️" title={text.search.empty} text={text.search.emptyText} />
          ) : (
            <View style={{ gap: 12 }}>
              {chunk(data.latest, 2).map((row, index) => (
                <View key={index} style={[t.row, { gap: 12 }]}>
                  {row.map((item) => (
                    <AdCard key={item.id} listing={item} onPress={() => openListing(item.id)} />
                  ))}
                  {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
                </View>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ شريط الأقسام */

/**
 * صفّ أفقي واحد يُسحب بالإصبع، لا شبكة تنزل تحت بعضها.
 *
 * الشبكة كانت تأكل شاشة الجوال كلها قبل أن يصل المستخدم إلى إعلان واحد.
 * الصفّ يُبقي الأقسام في متناول اليد ويترك المساحة للإعلانات — وهي سبب فتح
 * التطبيق أصلًا.
 */
export function CategoryRow({
  categories,
  onPress,
}: {
  categories: Category[];
  onPress: (category: Category) => void;
}) {
  const t = useTheme();
  const { config } = useAppConfig();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // الاتجاه يتبع لغة الواجهة: العربية تبدأ من اليمين
      contentContainerStyle={{
        gap: 10,
        paddingEnd: 4,
        flexDirection: t.isRTL ? 'row-reverse' : 'row',
      }}
    >
      {categories.map((category) => (
        <Pressable
          key={category.id}
          onPress={() => onPress(category)}
          style={({ pressed }) => ({
            width: 88,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.line,
            borderRadius: t.radius.md,
            paddingVertical: t.sp(12),
            paddingHorizontal: 6,
            alignItems: 'center',
            gap: 6,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: t.radius.md,
              backgroundColor: t.colors.brand50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt size={22}>{category.icon || '📦'}</Txt>
          </View>
          <Txt size={11.5} weight={700} align="center" numberOfLines={2} style={{ lineHeight: t.fs(16) }}>
            {category.name}
          </Txt>
          {config.features.show_listing_counts ? (
            <Txt size={10} weight={600} muted>
              {category.listings_count}
            </Txt>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
