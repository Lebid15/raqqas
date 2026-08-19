import { Image } from 'expo-image';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { ListingCard } from '../api/types';
import { useI18n } from '../i18n';
import { useFavorites } from '../state/FavoritesContext';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from './Toast';
import { Badge, Txt } from './ui';

/** صورة بديلة حين لا توجد صورة — بلون العلامة وأيقونة القسم. */
function Placeholder({ icon }: { icon?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.brand50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={40} style={{ opacity: 0.6 }}>
        {icon || '📦'}
      </Txt>
    </View>
  );
}

function FavoriteButton({ id }: { id: number }) {
  const t = useTheme();
  const toast = useToast();
  const { t: text } = useI18n();
  const favorites = useFavorites();
  const active = favorites.isFavorite(id);

  return (
    <Pressable
      onPress={async (event) => {
        event.stopPropagation();
        try {
          const added = await favorites.toggle(id);
          toast.show(added ? text.favorites.added : text.favorites.removed);
        } catch (error) {
          toast.show((error as Error).message);
        }
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        position: 'absolute',
        top: 8,
        [t.isRTL ? 'left' : 'right']: 8,
        width: 32,
        height: 32,
        borderRadius: t.radius.full,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.85 : 1 }],
        ...t.shadow('sm'),
      })}
    >
      <Txt size={15} color={active ? t.colors.danger : '#8B958F'}>
        {active ? '❤' : '♡'}
      </Txt>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ البطاقة */

export function AdCard({
  listing,
  onPress,
  width,
}: {
  listing: ListingCard;
  onPress: () => void;
  width?: number;
}) {
  const t = useTheme();
  const { t: text } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        flex: width ? undefined : 1,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.line,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ aspectRatio: 4 / 3, backgroundColor: t.colors.bg }}>
        {listing.thumb ? (
          <Image
            source={{ uri: listing.thumb }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Placeholder icon={listing.category?.parent?.icon || listing.category?.icon} />
        )}

        <View
          style={{
            position: 'absolute',
            top: 8,
            [t.isRTL ? 'right' : 'left']: 8,
            gap: 5,
            alignItems: 'flex-start',
          }}
        >
          {listing.is_featured ? (
            <Badge
              label={`⭐ ${text.listing.featured}`}
              background={t.colors.gold}
              color={t.colors.onGold}
            />
          ) : null}
          <Badge
            label={
              listing.condition === 'new' ? text.listing.conditionNew : text.listing.conditionUsed
            }
            background={listing.condition === 'new' ? 'rgba(21,128,61,0.92)' : 'rgba(0,0,0,0.55)'}
            color="#FFFFFF"
          />
        </View>

        {listing.photos_count > 0 ? (
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              [t.isRTL ? 'left' : 'right']: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: t.radius.full,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Txt size={10.5} weight={700} color="#FFFFFF">
              📷 {listing.photos_count}
              {listing.has_video ? ' · 🎬' : ''}
            </Txt>
          </View>
        ) : null}

        <FavoriteButton id={listing.id} />
      </View>

      <View style={{ padding: t.sp(11), gap: 5, flex: 1 }}>
        <Txt size={13.5} weight={700} numberOfLines={2} align="start" style={{ lineHeight: t.fs(20), minHeight: t.fs(39) }}>
          {listing.title}
        </Txt>
        <Txt size={15} weight={900} color={t.colors.brandText} align="start">
          {listing.price_text}
        </Txt>
        <View style={[t.row, { alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }]}>
          {listing.city ? (
            <Txt size={11} weight={600} muted>
              📍 {listing.address ? `${listing.city.name} · ${listing.address}` : listing.city.name}
            </Txt>
          ) : null}
          <Txt size={11} weight={600} muted>
            🕐 {listing.time_text}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ بطاقة أفقية */

export function AdRow({
  listing,
  onPress,
  children,
  showFavorite = true,
}: {
  listing: ListingCard;
  onPress: () => void;
  children?: React.ReactNode;
  showFavorite?: boolean;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        t.row,
        {
          gap: 11,
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.line,
          borderRadius: t.radius.md,
          padding: t.sp(10),
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 96,
          height: 88,
          borderRadius: t.radius.sm,
          overflow: 'hidden',
          backgroundColor: t.colors.bg,
        }}
      >
        {listing.thumb ? (
          <Image
            source={{ uri: listing.thumb }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Placeholder icon={listing.category?.parent?.icon || listing.category?.icon} />
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Txt size={13.5} weight={700} numberOfLines={2} align="start" style={{ lineHeight: t.fs(19) }}>
          {listing.title}
        </Txt>
        <Txt size={14} weight={900} color={t.colors.brandText} align="start">
          {listing.price_text}
        </Txt>
        <View style={[t.row, { alignItems: 'center', gap: 8, flexWrap: 'wrap' }]}>
          {listing.city ? (
            <Txt size={11} weight={600} muted>
              📍 {listing.address ? `${listing.city.name} · ${listing.address}` : listing.city.name}
            </Txt>
          ) : null}
          <Txt size={11} weight={600} muted>
            👁 {listing.views_count}
          </Txt>
        </View>
        {children ? <View style={{ marginTop: 'auto', paddingTop: 6 }}>{children}</View> : null}
      </View>

      {showFavorite ? (
        <View style={{ width: 34 }}>
          <FavoriteButton id={listing.id} />
        </View>
      ) : null}
    </Pressable>
  );
}
