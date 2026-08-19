import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import type { ListingCard, Paginated } from '../api/types';
import { STORAGE } from '../config';
import { useAuth } from './AuthContext';

/**
 * المفضلة.
 *
 * الزائر يحفظ على جهازه (قرار 17) — ثم عند أول تسجيل دخول تُنقل القائمة إلى
 * حسابه عبر /favorites/merge. بلا هذه الخطوة يفقد الناس ما جمعوه قبل التسجيل،
 * وهو أسوأ انطباع أول ممكن.
 */

type FavoritesValue = {
  ids: Set<number>;
  isFavorite: (id: number) => boolean;
  toggle: (id: number) => Promise<boolean>;
  count: number;
  /** آخر عدد نُقل عند الدمج — تعرضه الشاشة كرسالة ترحيب. */
  mergedCount: number | null;
  clearMergedNotice: () => void;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

async function readGuestFavorites(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE.guestFavorites);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [mergedCount, setMergedCount] = useState<number | null>(null);
  const mergedFor = useRef<number | null>(null);

  // ---------------------------------------------------------------- التحميل

  useEffect(() => {
    if (!ready) return;

    (async () => {
      if (!user) {
        setIds(new Set(await readGuestFavorites()));
        mergedFor.current = null;
        return;
      }

      // مستخدم جديد سجّل دخوله: انقل مفضلة الزائر مرة واحدة
      if (mergedFor.current !== user.id) {
        mergedFor.current = user.id;
        const guestIds = await readGuestFavorites();
        if (guestIds.length) {
          try {
            const result = await api.post<{ merged: number; total: number }>(
              '/favorites/merge',
              { listing_ids: guestIds },
            );
            await AsyncStorage.removeItem(STORAGE.guestFavorites);
            if (result.merged > 0) setMergedCount(result.merged);
          } catch {
            /* بلا إنترنت — نحاول في المرة القادمة، والقائمة المحلية تبقى */
          }
        }
      }

      try {
        const page = await api.get<Paginated<ListingCard>>('/favorites', { page_size: 60 });
        setIds(new Set(page.results.map((item) => item.id)));
      } catch {
        /* نبقى على ما هو محمّل */
      }
    })();
  }, [ready, user]);

  // ---------------------------------------------------------------- التبديل

  const toggle = useCallback(
    async (id: number) => {
      const adding = !ids.has(id);

      // تحديث فوري للواجهة ثم المزامنة — الضغط على القلب يجب ألا ينتظر الشبكة
      setIds((current) => {
        const next = new Set(current);
        if (adding) next.add(id);
        else next.delete(id);
        return next;
      });

      if (!user) {
        const guestIds = await readGuestFavorites();
        const next = adding
          ? Array.from(new Set([...guestIds, id]))
          : guestIds.filter((item) => item !== id);
        await AsyncStorage.setItem(STORAGE.guestFavorites, JSON.stringify(next));
        return adding;
      }

      try {
        if (adding) await api.post('/favorites', { listing: id });
        else await api.del(`/favorites/${id}`);
      } catch {
        // فشلت المزامنة — نتراجع عن التغيير حتى لا نُظهر حالة كاذبة
        setIds((current) => {
          const next = new Set(current);
          if (adding) next.delete(id);
          else next.add(id);
          return next;
        });
        throw new Error('تعذّر الحفظ — تحقّق من الإنترنت.');
      }
      return adding;
    },
    [ids, user],
  );

  const value = useMemo<FavoritesValue>(
    () => ({
      ids,
      isFavorite: (id: number) => ids.has(id),
      toggle,
      count: ids.size,
      mergedCount,
      clearMergedNotice: () => setMergedCount(null),
    }),
    [ids, toggle, mergedCount],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites يجب أن يُستخدم داخل FavoritesProvider');
  return context;
}
