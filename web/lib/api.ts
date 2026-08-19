/**
 * عميل الواجهة البرمجية للوحة الإدارة والصفحة التعريفية.
 *
 * نفس قواعد تطبيق الجوال: بلا شرطة مائلة أخيرة، ورسالة الخطأ تصل من الخادم
 * جاهزة بلغة المستخدم فتُعرض كما هي.
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://souq.syrz1.com/api/v1'
).replace(/\/$/, '');

export const TOKEN_KEY = 'souq.admin.tokens';

export type Tokens = { access: string; refresh: string };

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  field(name: string): string | undefined {
    return this.fields?.[name]?.[0];
  }
}

export function readTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: Tokens | null) {
  if (typeof window === 'undefined') return;
  if (tokens) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else window.localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  lang?: string;
  /** طلب عام لا يحتاج رمز دخول — يُستخدم في الصفحة التعريفية */
  anonymous?: boolean;
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  const tokens = readTokens();
  if (!tokens?.refresh) return false;

  refreshing = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (!response.ok) {
        writeTokens(null);
        return false;
      }
      const data = (await response.json()) as { access: string; refresh?: string };
      writeTokens({ access: data.access, refresh: data.refresh ?? tokens.refresh });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, lang = 'ar', anonymous = false } = options;

  const url = new URL(API_URL + (path.startsWith('/') ? path : `/${path}`));
  url.searchParams.set('lang', lang);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  // رفع الصور يمرّ كـ FormData: المتصفّح هو من يضع Content-Type مع الفاصل،
  // ووضعه يدويًا يكسر الطلب — لذلك نستثنيه هنا صراحة.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Language': lang };
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (!anonymous) {
      const tokens = readTokens();
      if (tokens) headers.Authorization = `Bearer ${tokens.access}`;
    }
    return fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      cache: 'no-store',
    });
  };

  let response = await send();

  // رمز منتهٍ — نجدّده مرة واحدة بصمت
  if (response.status === 401 && !anonymous && (await refreshTokens())) {
    response = await send();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const error = (data as { error?: { code: string; message: string; fields?: Record<string, string[]> } } | null)?.error;
    if (response.status === 401 && typeof window !== 'undefined' && !anonymous) {
      writeTokens(null);
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown',
      error?.message ?? 'حدث خطأ غير متوقّع.',
      error?.fields,
    );
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** «450,000 ل.س» — نفس قاعدة التطبيق: الرقم ثابت والرمز من الإعدادات. */
export function money(
  amount: number | null,
  currency: { symbol: string; position: string; decimals: number },
): string {
  if (amount === null || amount === undefined) return 'على السوم';
  const number = amount.toLocaleString('en-US', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  return currency.position === 'before'
    ? `${currency.symbol} ${number}`
    : `${number} ${currency.symbol}`;
}
