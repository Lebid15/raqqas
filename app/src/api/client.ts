import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL, REQUEST_TIMEOUT_MS, STORAGE, UPLOAD_TIMEOUT_MS } from '../config';
import type { ApiErrorBody, Lang, Tokens } from './types';

/** خطأ واجهة بشكل يفهمه التطبيق ويعرض رسالته للمستخدم مباشرة. */
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;
  retryAfter?: number;

  constructor(status: number, body: Partial<ApiErrorBody['error']> & { message: string }) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'unknown';
    this.fields = body.fields;
    this.retryAfter = body.retry_after;
  }

  /** أول رسالة خطأ خاصة بحقل — تُعرض تحت الحقل نفسه في النماذج. */
  fieldError(name: string): string | undefined {
    return this.fields?.[name]?.[0];
  }
}

/** انقطاع الشبكة — نميّزه لأن ردّ فعل التطبيق مختلف: نعرض المخزّن محليًا. */
export class OfflineError extends Error {
  /**
   * نصّ الخطأ الأصلي كما جاء من طبقة الشبكة.
   *
   * لا يُعرض للمستخدم في المسار العادي، لكن رفع الصور يعرضه في سطر صغير:
   * «تعذّر الوصول إلى الخادم» وحدها لا تفرّق بين شبكة مقطوعة وملفّ لم يُقرأ من
   * الجهاز — وهو فرق يغيّر الإصلاح تمامًا.
   */
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'OfflineError';
    this.detail = detail;
  }
}

type Listener = () => void;

class ApiClient {
  private tokens: Tokens | null = null;
  private lang: Lang = 'ar';
  private refreshing: Promise<boolean> | null = null;
  private unauthorizedListeners: Listener[] = [];

  // ---------------------------------------------------------------- الحالة

  async loadTokens(): Promise<Tokens | null> {
    const raw = await AsyncStorage.getItem(STORAGE.tokens);
    this.tokens = raw ? (JSON.parse(raw) as Tokens) : null;
    return this.tokens;
  }

  async setTokens(tokens: Tokens | null) {
    this.tokens = tokens;
    if (tokens) await AsyncStorage.setItem(STORAGE.tokens, JSON.stringify(tokens));
    else await AsyncStorage.removeItem(STORAGE.tokens);
  }

  get isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  /**
   * رمز الدخول الحالي.
   *
   * يحتاجه رفع الصور لأنه يمرّ بالطبقة الأصلية لا بـ `request()`، فيبني
   * ترويسته بنفسه. يقابله `renewAccessToken` عند انتهاء الصلاحية.
   */
  get accessToken(): string | null {
    return this.tokens?.access ?? null;
  }

  /** تجديد الرمز لمسار لا يمرّ بـ `request()` — يعيد الرمز الجديد أو null. */
  async renewAccessToken(): Promise<string | null> {
    if (!this.tokens?.refresh) return null;
    const refreshed = await this.refreshTokens();
    return refreshed ? (this.tokens?.access ?? null) : null;
  }

  setLanguage(lang: Lang) {
    this.lang = lang;
  }

  /** يُستدعى حين تنتهي صلاحية الجلسة نهائيًا — الشاشة تعيد المستخدم للتسجيل. */
  onUnauthorized(listener: Listener): () => void {
    this.unauthorizedListeners.push(listener);
    return () => {
      this.unauthorizedListeners = this.unauthorizedListeners.filter((l) => l !== listener);
    };
  }

  // ---------------------------------------------------------------- الطلب

  private url(path: string, query?: Record<string, unknown>): string {
    const url = new URL(API_URL + (path.startsWith('/') ? path : `/${path}`));
    url.searchParams.set('lang', this.lang);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Language': this.lang,
      ...extra,
    };
    if (this.tokens) headers.Authorization = `Bearer ${this.tokens.access}`;
    return headers;
  }

  private async raw(
    path: string,
    init: RequestInit,
    query?: Record<string, unknown>,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(this.url(path, query), { ...init, signal: controller.signal });
    } catch (error) {
      // انقطاع أو مهلة — كلاهما بالنسبة للمستخدم «لا يوجد اتصال»
      const aborted = (error as Error)?.name === 'AbortError';
      throw new OfflineError(
        aborted
          ? 'انتهت مهلة الاتصال. تحقّق من الإنترنت.'
          : 'تعذّر الوصول إلى الخادم. تحقّق من الإنترنت.',
        (error as Error)?.message,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, unknown>;
      formData?: FormData;
      retryOn401?: boolean;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const { body, query, formData, retryOn401 = true, timeoutMs } = options;

    const init: RequestInit = { method };
    if (formData) {
      init.body = formData;
      init.headers = this.headers();
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = this.headers({ 'Content-Type': 'application/json' });
    } else {
      init.headers = this.headers();
    }

    let response = await this.raw(path, init, query, timeoutMs);

    // انتهت صلاحية رمز الدخول — نجدّده مرة واحدة ونعيد المحاولة بصمت
    if (response.status === 401 && retryOn401 && this.tokens?.refresh) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        init.headers = formData
          ? this.headers()
          : this.headers(body !== undefined ? { 'Content-Type': 'application/json' } : undefined);
        response = await this.raw(path, init, query, timeoutMs);
      }
    }

    if (response.status === 204) return undefined as T;
    if (response.status === 304) return undefined as T;

    const text = await response.text();
    const data = text ? safeJson(text) : null;

    if (!response.ok) {
      if (response.status === 401) this.unauthorizedListeners.forEach((l) => l());
      const error = (data as ApiErrorBody | null)?.error;
      throw new ApiError(response.status, {
        code: error?.code,
        message: error?.message ?? 'حدث خطأ غير متوقّع.',
        fields: error?.fields,
        retry_after: error?.retry_after,
      });
    }

    return data as T;
  }

  private async refreshTokens(): Promise<boolean> {
    // طلبات متوازية كثيرة قد تكتشف انتهاء الصلاحية معًا — نجدّد مرة واحدة فقط
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const response = await this.raw('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh: this.tokens?.refresh }),
        });
        if (!response.ok) {
          await this.setTokens(null);
          this.unauthorizedListeners.forEach((l) => l());
          return false;
        }
        const data = (await response.json()) as { access: string; refresh?: string };
        await this.setTokens({
          access: data.access,
          refresh: data.refresh ?? this.tokens!.refresh,
        });
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  // ---------------------------------------------------------------- الاختصارات

  get<T>(path: string, query?: Record<string, unknown>) {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: unknown, query?: Record<string, unknown>) {
    return this.request<T>('POST', path, { body, query });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  del<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  upload<T>(path: string, formData: FormData) {
    return this.request<T>('POST', path, { formData, timeoutMs: UPLOAD_TIMEOUT_MS });
  }

  /** طلب app-config مع ETag — يعود null إن لم تتغيّر النسخة. */
  async getAppConfig(etag: string | null): Promise<{ data: unknown; etag: string } | null> {
    const response = await this.raw(
      '/app-config',
      { method: 'GET', headers: this.headers(etag ? { 'If-None-Match': etag } : undefined) },
      undefined,
    );
    if (response.status === 304) return null;
    if (!response.ok) throw new ApiError(response.status, { message: 'تعذّر تحميل الإعدادات.' });
    return { data: await response.json(), etag: response.headers.get('ETag') ?? '' };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = new ApiClient();

// ---------------------------------------------------------------- التخزين المحلّي

/**
 * ذاكرة القوائم.
 *
 * سبب وجودها في الخطة (plan2 §7.3): «يفتح ويعرض آخر بيانات فورًا ثم يحدّث».
 * على إنترنت الرقة الفرق بين شاشة فارغة تدور وشاشة فيها إعلانات هو الفرق
 * بين مستخدم يبقى ومستخدم يخرج.
 */
export const cache = {
  async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE.cache + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async write(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE.cache + key, JSON.stringify(value));
    } catch {
      /* الذاكرة ممتلئة — لا يستحق إفشال الشاشة لأجله */
    }
  },
  async clear(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(STORAGE.cache));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  },
};
