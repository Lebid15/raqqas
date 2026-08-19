import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';

import { api } from '../api/client';
import type { Category, City, ListingCard, Paginated } from '../api/types';
import { AdCard } from '../components/AdCard';
import { Field, Input } from '../components/Field';
import { Header } from '../components/Header';
import { OptionList, Sheet } from '../components/Sheet';
import { Button, Chip, Empty, Loader, Txt } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;
type Sort = 'newest' | 'price_asc' | 'price_desc' | 'views';

/** حالة المرشّحات كاملة في مكان واحد — يسهّل العدّ والمسح والمقارنة. */
type Filters = {
  /** أكثر من محافظة في آنٍ واحد — «كل المحافظات» = مصفوفة فارغة. */
  cityIds: number[];
  categorySlug: string | null;
  categoryName: string | null;
  condition: 'new' | 'used' | null;
  minPrice: string;
  maxPrice: string;
  sort: Sort;
};

const EMPTY: Filters = {
  cityIds: [],
  categorySlug: null,
  categoryName: null,
  condition: null,
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
};

export function SearchScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const { config, currency } = useAppConfig();
  const currencySymbol =
    config.currency.catalogue.find((c) => c.code === currency)?.symbol ?? currency;

  const [query, setQuery] = useState(route.params?.q ?? '');
  const [debounced, setDebounced] = useState(query);

  const [filters, setFilters] = useState<Filters>({
    ...EMPTY,
    categorySlug: route.params?.category ?? null,
    categoryName: route.params?.categoryName ?? null,
  });
  // نسخة العمل داخل النافذة — لا تُطبَّق إلا عند الضغط على «تطبيق»
  const [draft, setDraft] = useState<Filters>(filters);
  const [sheet, setSheet] = useState<'sort' | 'filters' | 'category' | null>(null);

  const [items, setItems] = useState<ListingCard[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const { data: cities } = useResource<City[]>('/cities', { cacheKey: 'cities' });
  const { data: categories } = useResource<Category[]>('/categories', { cacheKey: 'categories' });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 450);
    return () => clearTimeout(timer);
  }, [query]);

  const params = useMemo(
    () => ({
      q: debounced || undefined,
      category: filters.categorySlug ?? undefined,
      featured: route.params?.featured ? true : undefined,
      city: filters.cityIds.length ? filters.cityIds.join(',') : undefined,
      condition: filters.condition ?? undefined,
      min_price: filters.minPrice || undefined,
      max_price: filters.maxPrice || undefined,
      // حدّا السعر مكتوبان بعملة القارئ — بلا هذا يقارنهما الخادم بأرقام
      // إعلانات بعملات أخرى، فيصير «من 500» يلتقط إعلانًا بـ500 ليرة سورية.
      currency: filters.minPrice || filters.maxPrice ? currency : undefined,
      sort: filters.sort,
    }),
    [debounced, filters, route.params?.featured, currency],
  );

  const fetchPage = useCallback(
    async (nextPage: number) => {
      const isFirst = nextPage === 1;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      setFailed(false);

      try {
        const result = await api.get<Paginated<ListingCard>>('/listings', {
          ...params,
          page: nextPage,
        });
        setItems((current) => (isFirst ? result.results : [...current, ...result.results]));
        setTotal(result.count);
        setHasNext(result.has_next);
        setPage(result.page);
      } catch {
        setFailed(true);
        if (isFirst) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [params],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  // فتح النافذة مباشرة حين نأتي من زر «المرشّحات» في الرئيسية
  useEffect(() => {
    if (route.params?.openFilters) {
      setDraft(filters);
      setSheet('filters');
    }
    // مرة واحدة عند الدخول
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sortLabels: Record<Sort, string> = {
    newest: text.search.sortNewest,
    price_asc: text.search.sortPriceAsc,
    price_desc: text.search.sortPriceDesc,
    views: text.search.sortViews,
  };

  /* ---------------------------------------------------------------- الشرائح النشطة */

  const activeChips: { key: string; label: string; clear: () => void }[] = [];

  if (filters.categoryName) {
    activeChips.push({
      key: 'cat',
      label: `📂 ${filters.categoryName}`,
      clear: () => setFilters((f) => ({ ...f, categorySlug: null, categoryName: null })),
    });
  }
  filters.cityIds.forEach((id) => {
    const found = cities?.find((c) => c.id === id);
    if (!found) return;
    activeChips.push({
      key: `city-${id}`,
      label: `🏙️ ${found.name}`,
      clear: () =>
        setFilters((f) => ({ ...f, cityIds: f.cityIds.filter((item) => item !== id) })),
    });
  });
  if (filters.condition) {
    activeChips.push({
      key: 'cond',
      label:
        filters.condition === 'new' ? text.listing.conditionNew : text.listing.conditionUsed,
      clear: () => setFilters((f) => ({ ...f, condition: null })),
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    activeChips.push({
      key: 'price',
      label: `💰 ${filters.minPrice || '0'} – ${filters.maxPrice || '∞'}`,
      clear: () => setFilters((f) => ({ ...f, minPrice: '', maxPrice: '' })),
    });
  }

  const draftCount =
    draft.cityIds.length +
    (draft.condition ? 1 : 0) +
    (draft.minPrice ? 1 : 0) +
    (draft.maxPrice ? 1 : 0);

  const openFilters = () => {
    setDraft(filters);
    setSheet('filters');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Header
        variant="liveSearch"
        value={query}
        onChangeText={setQuery}
        onBack={() => navigation.goBack()}
        autoFocus={!route.params?.category && !route.params?.featured && !route.params?.openFilters}
      />

      {/* شريط الترتيب والمرشّحات — ظاهر دائمًا فوق النتائج */}
      <View style={[t.row, { gap: 8, paddingHorizontal: 14, paddingVertical: 10 }]}>
        <Pressable
          onPress={() => setSheet('sort')}
          style={({ pressed }) => [
            t.row,
            {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: t.sp(10),
              borderRadius: t.radius.md,
              backgroundColor: t.colors.surface,
              borderWidth: 1,
              borderColor: t.colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Txt size={14}>⇅</Txt>
          <Txt size={13} weight={800} numberOfLines={1}>
            {sortLabels[filters.sort]}
          </Txt>
        </Pressable>

        <Pressable
          onPress={openFilters}
          style={({ pressed }) => [
            t.row,
            {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: t.sp(10),
              borderRadius: t.radius.md,
              backgroundColor: activeChips.length ? t.colors.brand : t.colors.surface,
              borderWidth: 1,
              borderColor: activeChips.length ? t.colors.brand : t.colors.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Txt size={14} color={activeChips.length ? t.colors.onBrand : t.colors.ink}>
            ⚙
          </Txt>
          <Txt
            size={13}
            weight={800}
            color={activeChips.length ? t.colors.onBrand : t.colors.ink}
          >
            {text.search.filters}
            {activeChips.length ? ` (${activeChips.length})` : ''}
          </Txt>
        </Pressable>
      </View>

      {/* المرشّحات المطبّقة — كل واحدة تُزال بضغطة */}
      {activeChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}
          style={{ flexGrow: 0 }}
        >
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.clear}
              style={({ pressed }) => [
                t.row,
                {
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: t.sp(13),
                  paddingVertical: t.sp(7),
                  borderRadius: t.radius.full,
                  backgroundColor: t.colors.brand50,
                  borderWidth: 1,
                  borderColor: t.colors.brand100,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Txt size={12.5} weight={700} color={t.colors.brandText}>
                {chip.label}
              </Txt>
              <Txt size={11} color={t.colors.brandText}>
                ✕
              </Txt>
            </Pressable>
          ))}
          <Pressable onPress={() => setFilters({ ...EMPTY, sort: filters.sort })}>
            <Txt
              size={12.5}
              weight={800}
              color={t.colors.danger}
              style={{ paddingHorizontal: 8, paddingVertical: 7 }}
            >
              {text.common.reset}
            </Txt>
          </Pressable>
        </ScrollView>
      ) : null}

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Empty
          icon={failed ? '📡' : '🔍'}
          title={failed ? text.errors.offlineTitle : text.search.empty}
          text={failed ? text.errors.offlineEmpty : text.search.emptyText}
          action={failed ? text.common.retry : text.common.reset}
          onAction={() =>
            failed ? fetchPage(1) : setFilters({ ...EMPTY, sort: filters.sort })
          }
        />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          columnWrapperStyle={[t.row, { gap: 12, paddingHorizontal: 14 }]}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
              <Txt size={13} weight={700} color={t.colors.ink2} align="start">
                {tp(text.common.resultsCount, { count: total })}
              </Txt>
            </View>
          }
          renderItem={({ item }) => (
            <AdCard listing={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNext && !loadingMore) void fetchPage(page + 1);
          }}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={t.colors.brandText} />
              </View>
            ) : null
          }
        />
      )}

      {/* ---------------------------------------------------------- الترتيب */}
      <Sheet visible={sheet === 'sort'} title={text.search.sort} onClose={() => setSheet(null)}>
        <OptionList
          options={(Object.keys(sortLabels) as Sort[]).map((key) => ({
            value: key,
            label: sortLabels[key],
          }))}
          value={filters.sort}
          onChange={(value) => {
            setFilters((f) => ({ ...f, sort: value }));
            setSheet(null);
          }}
        />
      </Sheet>

      {/* ---------------------------------------------------------- المرشّحات */}
      <Sheet
        visible={sheet === 'filters'}
        title={`${text.search.filters}${draftCount ? ` (${draftCount})` : ''}`}
        onClose={() => setSheet(null)}
        footer={
          <>
            <Button
              title={text.common.reset}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => setDraft({ ...EMPTY, sort: draft.sort })}
            />
            <Button
              title={text.common.apply}
              style={{ flex: 1 }}
              onPress={() => {
                setFilters(draft);
                setSheet(null);
              }}
            />
          </>
        }
      >
        {/* القسم */}
        <Field label={text.search.category}>
          <Pressable onPress={() => setSheet('category')}>
            <View
              style={[
                t.row,
                {
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1.5,
                  borderColor: t.colors.line,
                  borderRadius: t.radius.md,
                  paddingHorizontal: t.sp(14),
                  paddingVertical: t.sp(12),
                },
              ]}
            >
              <Txt size={16}>📂</Txt>
              <Txt
                size={14.5}
                style={{ flex: 1 }}
                align="start"
                color={draft.categoryName ? t.colors.ink : t.colors.ink3}
              >
                {draft.categoryName || text.search.allCategories}
              </Txt>
              <Txt size={12} muted>
                {t.isRTL ? '‹' : '›'}
              </Txt>
            </View>
          </Pressable>
        </Field>

        {/* المحافظة — يمكن اختيار أكثر من واحدة */}
        <Field
          label={text.search.city}
          hint={
            draft.cityIds.length
              ? tp(text.search.citiesChosen, { count: draft.cityIds.length })
              : text.search.cityHint
          }
        >
          <View style={[t.row, { gap: 8, flexWrap: 'wrap' }]}>
            <Chip
              label={text.search.allCities}
              active={draft.cityIds.length === 0}
              onPress={() => setDraft((d) => ({ ...d, cityIds: [] }))}
            />
            {(cities ?? []).map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                active={draft.cityIds.includes(item.id)}
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    cityIds: d.cityIds.includes(item.id)
                      ? d.cityIds.filter((id) => id !== item.id)
                      : [...d.cityIds, item.id],
                  }))
                }
              />
            ))}
          </View>
        </Field>

        {/* نطاق السعر */}
        <Field label={`${text.search.priceRange} (${currencySymbol})`}>
          <View style={[t.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Input
                value={draft.minPrice}
                onChangeText={(value) =>
                  setDraft((d) => ({ ...d, minPrice: value.replace(/[^\d]/g, '') }))
                }
                placeholder={text.search.priceFrom}
                keyboardType="number-pad"
                ltr
              />
            </View>
            <Txt size={16} muted>
              —
            </Txt>
            <View style={{ flex: 1 }}>
              <Input
                value={draft.maxPrice}
                onChangeText={(value) =>
                  setDraft((d) => ({ ...d, maxPrice: value.replace(/[^\d]/g, '') }))
                }
                placeholder={text.search.priceTo}
                keyboardType="number-pad"
                ltr
              />
            </View>
          </View>
        </Field>

        {/* الحالة */}
        <Field label={text.search.condition}>
          <View style={[t.row, { gap: 8, flexWrap: 'wrap' }]}>
            <Chip
              label={text.common.all}
              active={draft.condition === null}
              onPress={() => setDraft((d) => ({ ...d, condition: null }))}
            />
            <Chip
              label={text.listing.conditionNew}
              active={draft.condition === 'new'}
              onPress={() => setDraft((d) => ({ ...d, condition: 'new' }))}
            />
            <Chip
              label={text.listing.conditionUsed}
              active={draft.condition === 'used'}
              onPress={() => setDraft((d) => ({ ...d, condition: 'used' }))}
            />
          </View>
        </Field>
      </Sheet>

      {/* ---------------------------------------------------------- اختيار القسم */}
      <Sheet
        visible={sheet === 'category'}
        title={text.search.category}
        onClose={() => setSheet('filters')}
      >
        <OptionList
          options={[
            { value: '', label: text.search.allCategories },
            ...(categories ?? []).flatMap((parent) => [
              {
                value: parent.slug,
                label: `${parent.icon || '📦'}  ${parent.name}`,
              },
              ...(parent.children ?? []).map((child) => ({
                value: child.slug,
                label: `      ${child.name}`,
              })),
            ]),
          ]}
          value={draft.categorySlug ?? ''}
          onChange={(value) => {
            if (!value) {
              setDraft((d) => ({ ...d, categorySlug: null, categoryName: null }));
            } else {
              const parent = categories?.find((c) => c.slug === value);
              const child = categories
                ?.flatMap((c) => c.children ?? [])
                .find((c) => c.slug === value);
              setDraft((d) => ({
                ...d,
                categorySlug: String(value),
                categoryName: parent?.name ?? child?.name ?? null,
              }));
            }
            setSheet('filters');
          }}
        />
      </Sheet>
    </View>
  );
}
