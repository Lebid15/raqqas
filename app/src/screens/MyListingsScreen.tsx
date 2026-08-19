import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';

import { api } from '../api/client';
import type { MyListing, Paginated } from '../api/types';
import { AdRow } from '../components/AdCard';
import { SubHeader } from '../components/Header';
import { useToast } from '../components/Toast';
import { Button, Chip, Empty, Loader, Notice, StatusPill, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'MyListings'>;
type Filter = 'all' | 'published' | 'pending' | 'rejected' | 'expired';

/** الموقوف والمحذوف ترفض الخلفية تعديلهما — فلا نعرض الزر أصلًا. */
const EDITABLE_STATUSES = ['draft', 'pending', 'published', 'rejected', 'expired'];

export function MyListingsScreen({ navigation }: Props) {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<MyListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const page = await api.get<Paginated<MyListing>>('/listings/mine', {
          status: filter === 'all' ? undefined : filter,
          page_size: 40,
        });
        setItems(page.results);
        if (page.counts) setCounts(page.counts);
      } catch {
        /* بلا إنترنت */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  // عند العودة من شاشة التعديل تكون الحالة قد تغيّرت (منشور ← قيد المراجعة)،
  // فنعيد التحميل عند كل ظهور بدل عرض حالة قديمة يظنّها المستخدم صحيحة.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = (listing: MyListing) => {
    Alert.alert(text.common.delete, text.myListings.deleteConfirm, [
      { text: text.common.cancel, style: 'cancel' },
      {
        text: text.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/listings/${listing.id}`);
            setItems((current) => current.filter((item) => item.id !== listing.id));
            toast.show(text.myListings.deleted);
          } catch {
            toast.show(text.errors.generic);
          }
        },
      },
    ]);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: text.common.all },
    { key: 'published', label: text.status.published },
    { key: 'pending', label: text.status.pending },
    { key: 'rejected', label: text.status.rejected },
    { key: 'expired', label: text.status.expired },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SubHeader title={text.myListings.title} onBack={() => navigation.goBack()} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 12 }}
        style={{ flexGrow: 0 }}
      >
        {filters.map((item) => (
          <Chip
            key={item.key}
            label={
              item.key === 'all'
                ? item.label
                : `${item.label}${counts[item.key] ? ` (${counts[item.key]})` : ''}`
            }
            active={filter === item.key}
            onPress={() => {
              setFilter(item.key);
              setLoading(true);
            }}
          />
        ))}
      </ScrollView>

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Empty
          icon="📋"
          title={text.myListings.empty}
          text={text.myListings.emptyText}
          action={text.myListings.emptyCta}
          onAction={() => {
            navigation.goBack();
            navigation.navigate('Add');
          }}
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
          renderItem={({ item }) => (
            <View style={{ gap: 8 }}>
              <AdRow
                listing={item}
                showFavorite={false}
                onPress={() => navigation.navigate('Listing', { id: item.id })}
              >
                <View style={[t.row, { gap: 6, alignItems: 'center', flexWrap: 'wrap' }]}>
                  <StatusPill
                    status={item.status}
                    label={text.status[item.status as keyof typeof text.status] as string}
                  />
                  <Txt size={11} weight={600} muted>
                    💬 {item.contacts_count} · ❤ {item.favorites_count}
                  </Txt>
                </View>
              </AdRow>

              {item.status === 'rejected' && item.rejection_reason ? (
                <Notice tone="danger">
                  {tp(text.status.rejectedNote, { reason: item.rejection_reason })}
                </Notice>
              ) : item.status === 'pending' ? (
                <Notice tone="warn">{text.status.pendingNote}</Notice>
              ) : null}

              <View style={[t.row, { gap: 8 }]}>
                {EDITABLE_STATUSES.includes(item.status) ? (
                  <Button
                    title={text.myListings.edit}
                    icon="✏️"
                    variant="soft"
                    size="sm"
                    onPress={() => navigation.navigate('EditListing', { id: item.id })}
                  />
                ) : null}
                <Button
                  title={text.common.delete}
                  variant="ghost"
                  size="sm"
                  onPress={() => remove(item)}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
