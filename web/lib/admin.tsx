'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, api, readTokens, writeTokens, type Tokens } from './api';

/* ------------------------------------------------------------------ الأنواع */

export type AdminUser = {
  id: number;
  name: string;
  phone: string;
  phone_display: string;
  role: 'user' | 'moderator' | 'admin';
};

export type AppConfigTheme = Record<string, string>;

export type AppConfig = {
  version: number;
  brand: {
    name: string;
    names: Record<string, string>;
    mark: string;
    logo: string | null;
    /** تُعرض في اللوحة فقط — لا يمكن تبديلها على جهاز مثبَّت. */
    launcher_icon: string | null;
  };
  theme: {
    light: AppConfigTheme;
    dark: AppConfigTheme;
    font: { family: string; scale: number };
    radius: Record<string, number>;
    shadows: string;
    density: string;
    darkModeEnabled: boolean;
  };
  currency: {
    base: string;
    default: string;
    enabled: string[];
    catalogue: {
      code: string; symbol: string; symbols: Record<string, string>;
      name: string; names: Record<string, string>; decimals: number;
    }[];
    rates: Record<string, number>;
    rates_updated_at: string | null;
  };
  languages: { supported: string[]; default: string; rtl: string[] };
  landing: Record<string, LandingText | string | null>;
  app: {
    latest_version: string; min_version: string; store_url: string;
    apk_url: string; apk_sha256: string; apk_size_mb: number; update_message: string;
  };
  features: Record<string, boolean>;
  limits: Record<string, number>;
  support: { whatsapp: string; email: string };
  legal: { privacy: string; terms: string; delete_account: string };
};

export type LandingText = {
  headline: string; subline: string; body: string; cta: string;
  features: { icon: string; title: string; text: string }[];
};

export type ContrastWarning = {
  mode: 'light' | 'dark';
  foreground: string;
  background: string;
  label: string;
  ratio?: number;
  required?: number;
  level: 'warning' | 'error';
  message: string;
};

export type AdminConfigPayload = {
  config: AppConfig;
  editable: Record<string, unknown>;
  warnings: ContrastWarning[];
  meta: {
    color_groups: { key: string; label_ar: string; keys: string[] }[];
    fonts: string[];
    shadows: string[];
    densities: string[];
    currencies: {
      code: string;
      symbol: string;
      symbols: { ar: string; tr: string; en: string };
      name: string;
      names: { ar: string; tr: string; en: string };
      decimals: number;
    }[];
    /** العملات التي تحتاج سعر صرف — كل شيء عدا المحور نفسه. */
    rate_codes: string[];
    base_currency: string;
  };
};

/* ------------------------------------------------------------------ الجلسة */

type AdminValue = {
  user: AdminUser | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<AdminUser>;
  logout: () => void;
  toast: (message: string) => void;
};

const AdminContext = createContext<AdminValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!readTokens()) {
        setReady(true);
        return;
      }
      try {
        setUser(await api<AdminUser>('/auth/me'));
      } catch {
        writeTokens(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const toast = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2800);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const data = await api<{ user: AdminUser; tokens: Tokens }>('/auth/login', {
      method: 'POST',
      body: { phone, password },
      anonymous: true,
    });
    // اللوحة للإدارة فقط — لا نُدخل مستخدمًا عاديًا إلى شاشة فارغة ثم نمنعه
    if (data.user.role === 'user') {
      throw new ApiError(403, 'permission_denied', 'هذا الحساب ليس حساب إدارة.');
    }
    writeTokens(data.tokens);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    writeTokens(null);
    setUser(null);
    router.push('/admin/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, ready, login, logout, toast }),
    [user, ready, login, logout, toast],
  );

  return (
    <AdminContext.Provider value={value}>
      {children}
      {message ? <div className="toast">{message}</div> : null}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminValue {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin يجب أن يُستخدم داخل AdminProvider');
  return context;
}

/* ------------------------------------------------------------------ جلب البيانات */

export function useApi<T>(path: string | null, query?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const key = JSON.stringify(query ?? {});

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path, { query }));
      setError(null);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setLoading(false);
    }
  }, [path, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

/* ------------------------------------------------------------------ عناصر مشتركة */

export function Spinner() {
  return <div className="spinner" />;
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text ? <div className="empty-text">{text}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'success' | 'danger';
  children: React.ReactNode;
}) {
  const icons = { info: 'ℹ️', warn: '⚠️', success: '✅', danger: '⛔' };
  return (
    <div className={`notice notice-${tone}`}>
      <span>{icons[tone]}</span>
      <span className="grow">{children}</span>
    </div>
  );
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودّة',
  pending: 'قيد المراجعة',
  published: 'منشور',
  rejected: 'مرفوض',
  expired: 'منتهٍ',
  suspended: 'موقوف',
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

/** «منذ 12 دقيقة» — لعرض زمن الانتظار في صفّ المراجعة. */
export function waitLabel(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعة`;
  return `${Math.floor(hours / 24)} يوم`;
}
