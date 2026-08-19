import { useCallback, useEffect, useRef, useState } from 'react';

import { api, cache, OfflineError } from '../api/client';

/**
 * جلب بيانات مع تخزين محلّي.
 *
 * السلوك المقصود (plan2 §7.3): الشاشة تعرض آخر نسخة محفوظة **فورًا**، ثم تحدّث
 * بهدوء حين يصل الردّ. على إنترنت ضعيف هذا هو الفرق بين شاشة تدور وشاشة فيها
 * محتوى — وبين مستخدم يبقى ومستخدم يخرج.
 */
export function useResource<T>(
  path: string | null,
  options: {
    query?: Record<string, unknown>;
    cacheKey?: string;
    enabled?: boolean;
  } = {},
) {
  const { query, cacheKey, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const queryKey = JSON.stringify(query ?? {});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!path || !enabled) return;
      if (isRefresh) setRefreshing(true);

      // 1) المخزّن محليًا أولًا — بلا انتظار الشبكة
      if (!isRefresh && cacheKey) {
        const cached = await cache.read<T>(cacheKey);
        if (cached && mounted.current) {
          setData(cached);
          setFromCache(true);
          setLoading(false);
        }
      }

      try {
        const fresh = await api.get<T>(path, query);
        if (!mounted.current) return;
        setData(fresh);
        setFromCache(false);
        setError(null);
        if (cacheKey) void cache.write(cacheKey, fresh);
      } catch (caught) {
        if (!mounted.current) return;
        // بلا إنترنت ومعنا نسخة محفوظة: لا نُظهر خطأ، بل شريط «لا يوجد اتصال»
        if (caught instanceof OfflineError && cacheKey) setFromCache(true);
        setError(caught as Error);
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, queryKey, enabled, cacheKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // مرجع ثابت: الشاشات تضعه في مصفوفة اعتماديات useFocusEffect، ودالة جديدة
  // مع كل رسم كانت تعني حلقة تحديث لا تنتهي.
  const refresh = useCallback(() => load(true), [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    /** true حين نعرض بيانات محفوظة لأن الشبكة غير متاحة */
    stale: fromCache && error instanceof OfflineError,
    refresh,
    setData,
  };
}
