import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import type { Category } from '../api/types';
import { Header } from '../components/Header';
import { Empty, Loader, Txt } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useAppConfig } from '../state/AppConfigContext';
import { useTheme } from '../theme/ThemeProvider';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** شاشة الأقسام — مطابقة لـ design/categories.html (صفوف قابلة للفتح). */
export function CategoriesScreen() {
  const t = useTheme();
  const { t: text, tp } = useI18n();
  const navigation = useNavigation<Nav>();
  const [open, setOpen] = useState<number | null>(null);

  const { data, loading, refreshing, refresh } = useResource<Category[]>('/categories', {
    cacheKey: 'categories',
  });

  const goToCategory = (slug: string, name: string) =>
    navigation.navigate('Search', { category: slug, categoryName: name });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <Header variant="title" title={text.categories.title} />

      {loading && !data ? (
        <Loader />
      ) : !data || data.length === 0 ? (
        <Empty icon="📂" title={text.categories.title} text={text.errors.offlineEmpty} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.brand} />
          }
        >
          {data.map((category) => {
            const expanded = open === category.id;
            return (
              <View
                key={category.id}
                style={{
                  backgroundColor: t.colors.surface,
                  borderWidth: 1,
                  borderColor: t.colors.line,
                  borderRadius: t.radius.md,
                  overflow: 'hidden',
                }}
              >
                <Pressable
                  onPress={() =>
                    category.children?.length
                      ? setOpen(expanded ? null : category.id)
                      : goToCategory(category.slug, category.name)
                  }
                  style={({ pressed }) => [
                    t.row,
                    {
                      alignItems: 'center',
                      gap: 12,
                      padding: t.sp(13),
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: t.radius.md,
                      backgroundColor: t.colors.brand50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt size={20}>{category.icon || '📦'}</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={14.5} weight={800} align="start">
                      {category.name}
                    </Txt>
                    <Txt size={11.5} weight={600} muted align="start">
                      {tp(text.categories.listingsCount, { count: category.listings_count })}
                      {category.children?.length ? ` · ${category.children.length}` : ''}
                    </Txt>
                  </View>
                  <Txt size={16} muted>
                    {category.children?.length
                      ? expanded
                        ? '⌄'
                        : t.isRTL
                          ? '‹'
                          : '›'
                      : t.isRTL
                        ? '‹'
                        : '›'}
                  </Txt>
                </Pressable>

                {expanded && category.children?.length ? (
                  <View
                    style={[
                      t.row,
                      { flexWrap: 'wrap', gap: 7, paddingHorizontal: t.sp(14), paddingBottom: t.sp(14) },
                    ]}
                  >
                    <SubChip
                      label={text.categories.all}
                      onPress={() => goToCategory(category.slug, category.name)}
                      highlighted
                    />
                    {category.children.map((child) => (
                      <SubChip
                        key={child.id}
                        label={child.name}
                        onPress={() => goToCategory(child.slug, child.name)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function SubChip({
  label,
  onPress,
  highlighted,
}: {
  label: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: highlighted ? t.colors.brand50 : t.colors.bg,
        borderWidth: 1,
        borderColor: highlighted ? t.colors.brand100 : t.colors.line,
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: t.radius.full,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt size={12.5} weight={700} color={highlighted ? t.colors.brandText : t.colors.ink2}>
        {label}
      </Txt>
    </Pressable>
  );
}
