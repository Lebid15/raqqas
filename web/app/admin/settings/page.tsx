'use client';

import React, { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { Notice, Spinner, useAdmin, useApi, type AdminConfigPayload, type LandingText } from '@/lib/admin';

/**
 * الإعدادات: العملة · المراجعة · الحدود · الصفحة التعريفية · نسخة التطبيق.
 *
 * كل ما هنا يمرّ عبر app_config — أي أنه يصل التطبيقات بلا إصدار جديد
 * (القاعدة الملزمة في plan2 §4.2).
 */

const LANGS: { code: 'ar' | 'tr' | 'en'; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

const FEATURE_LABELS: Record<string, string> = {
  whatsapp_enabled: 'زر التواصل عبر واتساب',
  chat_enabled: 'المحادثة الداخلية (بعد الإطلاق)',
  featured_enabled: 'الإعلانات المميّزة المدفوعة',
  ratings_enabled: 'تقييم البائعين',
  guest_favorites: 'مفضلة الزائر على جهازه',
  phone_verification: 'التحقّق من رقم الهاتف برسالة',
  show_view_counts: 'إظهار عدّاد المشاهدات',
  show_listing_counts: 'إظهار عدد الإعلانات بجانب الأقسام',
};

const REVIEW_MODES: { value: string; label: string; hint: string }[] = [
  { value: 'all', label: 'مراجعة كل إعلان', hint: 'الأدقّ — وأبطأ للبائعين' },
  {
    value: 'new_users',
    label: 'مراجعة إعلانات الجدد فقط',
    hint: 'من تجاوز عدد الإعلانات المقبولة يُنشر مباشرة',
  },
  { value: 'off', label: 'نشر فوري بلا مراجعة', hint: 'الأسرع — وأخطر' },
];

export default function SettingsPage() {
  const { toast } = useAdmin();
  const { data, loading, reload } = useApi<AdminConfigPayload>('/admin/app-config');

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [landing, setLanding] = useState<Record<string, LandingText>>({});
  const [lang, setLang] = useState<'ar' | 'tr' | 'en'>('ar');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [currencyWarning, setCurrencyWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({ ...(data.editable as Record<string, unknown>) });
    setLanding({
      ar: (data.config.landing.ar as LandingText) ?? emptyLanding(),
      tr: (data.config.landing.tr as LandingText) ?? emptyLanding(),
      en: (data.config.landing.en as LandingText) ?? emptyLanding(),
    });
    setDirty(false);
  }, [data]);

  const set = (key: string, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const setLandingField = (field: keyof LandingText, value: string) => {
    setLanding((current) => ({ ...current, [lang]: { ...current[lang], [field]: value } }));
    setDirty(true);
  };

  /**
   * رفع الشعار أو أيقونة الجوال.
   *
   * منفصل عن زرّ «حفظ التغييرات» عمدًا: الصورة تُرسل multipart لا JSON، وربطها
   * بالحفظ العام كان يعني إرسال النموذج كلّه في كل مرة يختار فيها الأدمن ملفًا.
   */
  const uploadImage = async (field: 'logo' | 'launcher_icon', file: File) => {
    setUploading(field);
    try {
      const payload = new FormData();
      payload.append(field, file);
      await api('/admin/app-config', { method: 'PATCH', body: payload });
      toast(field === 'logo' ? '✅ حُدّث الشعار' : '✅ حُفظت أيقونة الجوال');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setBusy(true);
    setCurrencyWarning(null);
    try {
      const result = await api<AdminConfigPayload>('/admin/app-config', {
        method: 'PATCH',
        body: {
          app_name_ar: form.app_name_ar,
          app_name_tr: form.app_name_tr,
          app_name_en: form.app_name_en,
          brand_mark: form.brand_mark,
          currency_code: form.currency_code,
          currency_symbol: form.currency_symbol,
          currency_symbol_tr: form.currency_symbol_tr,
          currency_symbol_en: form.currency_symbol_en,
          currency_position: form.currency_position,
          currency_decimals: Number(form.currency_decimals ?? 0),
          review_mode: form.review_mode,
          review_threshold: Number(form.review_threshold ?? 3),
          listing_expiry_days: Number(form.listing_expiry_days ?? 60),
          daily_listing_limit: Number(form.daily_listing_limit ?? 5),
          max_photos_per_listing: Number(form.max_photos_per_listing ?? 10),
          default_language: form.default_language,
          features: form.features,
          support_whatsapp: form.support_whatsapp,
          support_email: form.support_email,
          apk_url: form.apk_url,
          latest_version: form.latest_version,
          min_version: form.min_version,
          update_message_ar: form.update_message_ar,
          update_message_tr: form.update_message_tr,
          update_message_en: form.update_message_en,
          landing_ar: landing.ar,
          landing_tr: landing.tr,
          landing_en: landing.en,
        },
      });
      if (result.currency_warning) setCurrencyWarning(result.currency_warning);
      setDirty(false);
      toast('✅ حُفظت الإعدادات');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  if (!data) return <Notice tone="danger">تعذّر تحميل الإعدادات.</Notice>;

  const features = (form.features ?? {}) as Record<string, boolean>;
  const currencyChanged =
    data.config.currency.code !== form.currency_code ||
    data.config.currency.symbol !== form.currency_symbol;

  return (
    <div>
      <div className="row-between mb-16">
        <div>
          <h1 className="page-title">⚙️ الإعدادات</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            كل ما هنا يصل التطبيقات بلا إصدار جديد
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? 'جاري الحفظ…' : dirty ? 'حفظ التغييرات' : 'محفوظ'}
        </button>
      </div>

      {currencyWarning ? (
        <div className="mb-16">
          <Notice tone="warn">{currencyWarning}</Notice>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- الهوية */}
      <div className="card mb-16">
        <div className="card-title">🎨 هوية التطبيق</div>
        <p className="hint mb-12">
          الاسم والشعار يصلان التطبيقات المثبَّتة فورًا. أيقونة الجوال وحدها استثناء —
          تفسيرها تحتها.
        </p>

        <div className="row-3">
          {LANGS.map((item) => (
            <div className="field" key={item.code}>
              <label className="label">
                اسم التطبيق ({item.label})
                {item.code === 'ar' ? <span className="req"> *</span> : null}
              </label>
              <input
                className="input"
                value={String(form[`app_name_${item.code}`] ?? '')}
                placeholder={item.code === 'ar' ? 'سوق الرقة' : String(form.app_name_ar ?? '')}
                onChange={(e) => set(`app_name_${item.code}`, e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className="hint mb-12">
          يُترك التركي والإنكليزي فارغين فيقعان على الاسم العربي.
        </p>

        <div className="row-2">
          <div className="field">
            <label className="label">شعار التطبيق</label>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <BrandPreview
                src={data.config.brand?.logo ?? null}
                fallback={String(form.brand_mark ?? 'س')}
              />
              <div className="grow">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage('logo', file);
                    e.target.value = '';
                  }}
                />
                <p className="hint" style={{ marginTop: 6 }}>
                  {uploading === 'logo'
                    ? 'جاري الرفع…'
                    : 'يظهر في ترويسة التطبيق. مربّع، 256×256 على الأقل.'}
                </p>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="label">حرف العلامة (بديل الشعار)</label>
            <input
              className="input"
              maxLength={4}
              value={String(form.brand_mark ?? '')}
              onChange={(e) => set('brand_mark', e.target.value)}
            />
            <p className="hint">يظهر داخل المربّع حين لا يوجد شعار مرفوع.</p>
          </div>
        </div>

        <div className="field">
          <label className="label">أيقونة الجوال</label>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <BrandPreview src={data.config.brand?.launcher_icon ?? null} fallback="📱" />
            <div className="grow">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage('launcher_icon', file);
                  e.target.value = '';
                }}
              />
              <p className="hint" style={{ marginTop: 6 }}>
                {uploading === 'launcher_icon' ? 'جاري الرفع…' : 'مربّعة، 512×512 مستحسن.'}
              </p>
            </div>
          </div>
          <div className="mt-12">
            <Notice tone="warn">
              <b>أيقونة الجوال واسمه تحتهما لا يتغيّران على جهاز مثبَّت.</b> أندرويد
              يثبّتهما عند التثبيت، فلا سبيل لتبديلهما إلا بنسخة APK جديدة. ارفع الأيقونة
              هنا، وستُستعمل في البناء التالي تلقائيًا. أما الاسم والشعار <b>داخل</b>{' '}
              التطبيق فيتغيّران فورًا.
            </Notice>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- العملة */}
      <div className="card mb-16">
        <div className="card-title">💱 العملة</div>

        {currencyChanged ? (
          <div className="mb-12">
            <Notice tone="danger">
              <b>انتبه:</b> تغيير العملة <b>لا يحوّل الأسعار المنشورة</b>. إعلان سعره
              450000 سيُقرأ كما هو بالعملة الجديدة. الرقم لا يتغيّر — الرمز فقط.
            </Notice>
          </div>
        ) : (
          <p className="hint mb-12">
            عملة واحدة للسوق كلّه. الأسعار تُخزَّن أرقامًا بلا عملة، والرمز يُضاف عند العرض.
          </p>
        )}

        <div className="row-3">
          <div className="field">
            <label className="label">العملة</label>
            <select
              className="select"
              value={String(form.currency_code ?? 'SYP')}
              onChange={(e) => {
                const known = data.meta.currencies.find((c) => c.code === e.target.value);
                set('currency_code', e.target.value);
                if (known) {
                  set('currency_symbol', known.symbol_ar);
                  set('currency_symbol_tr', known.symbol_tr);
                  set('currency_symbol_en', known.symbol_en);
                }
              }}
            >
              {data.meta.currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">الرمز (عربي)</label>
            <input
              className="input"
              value={String(form.currency_symbol ?? '')}
              onChange={(e) => set('currency_symbol', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">موضع الرمز</label>
            <select
              className="select"
              value={String(form.currency_position ?? 'after')}
              onChange={(e) => set('currency_position', e.target.value)}
            >
              <option value="after">بعد المبلغ — 450,000 ل.س</option>
              <option value="before">قبل المبلغ — $ 450,000</option>
            </select>
          </div>
        </div>

        <div className="row-2">
          <div className="field">
            <label className="label">الرمز (تركي)</label>
            <input
              className="input"
              value={String(form.currency_symbol_tr ?? '')}
              onChange={(e) => set('currency_symbol_tr', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">الرمز (إنكليزي)</label>
            <input
              className="input"
              value={String(form.currency_symbol_en ?? '')}
              onChange={(e) => set('currency_symbol_en', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- المراجعة */}
      <div className="card mb-16">
        <div className="card-title">✅ المراجعة والحدود</div>

        <div className="field">
          <label className="label">نمط المراجعة</label>
          <div className="stack" style={{ gap: 8 }}>
            {REVIEW_MODES.map((mode) => (
              <label
                key={mode.value}
                className="row"
                style={{
                  border: `1.5px solid ${form.review_mode === mode.value ? 'var(--brand)' : 'var(--line)'}`,
                  background: form.review_mode === mode.value ? 'var(--brand-50)' : 'var(--surface)',
                  borderRadius: 'var(--r)',
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="review_mode"
                  checked={form.review_mode === mode.value}
                  onChange={() => set('review_mode', mode.value)}
                />
                <span className="grow">
                  <span className="bold" style={{ display: 'block', fontSize: 14 }}>
                    {mode.label}
                  </span>
                  <span className="muted txt-sm">{mode.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="hint">
            باب الخروج جاهز: إن أرهقتك المراجعة، بدّل إلى «الجدد فقط» — بلا أي تعديل برمجي.
          </p>
        </div>

        <div className="row-3">
          <Num form={form} set={set} k="review_threshold" label="إعلانات مقبولة قبل الثقة" />
          <Num form={form} set={set} k="daily_listing_limit" label="حدّ الإعلانات اليومي" />
          <Num form={form} set={set} k="max_photos_per_listing" label="أقصى عدد صور" />
        </div>
        <div className="row-2">
          <Num form={form} set={set} k="listing_expiry_days" label="مدة صلاحية الإعلان (يوم)" />
        </div>
      </div>

      {/* ---------------------------------------------------------- المزايا */}
      <div className="card mb-16">
        <div className="card-title">🔀 تشغيل وإيقاف المزايا</div>
        <div className="swatch-grid">
          {Object.keys(FEATURE_LABELS).map((key) => (
            <label
              key={key}
              className="row"
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--r)',
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(features[key])}
                onChange={(e) => set('features', { ...features, [key]: e.target.checked })}
              />
              <span className="txt-sm bold">{FEATURE_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------- الصفحة التعريفية */}
      <div className="card mb-16">
        <div className="card-title">🌐 نصوص الصفحة التعريفية</div>

        <div className="tabs">
          {LANGS.map((item) => (
            <button
              key={item.code}
              className={`tab${lang === item.code ? ' is-active' : ''}`}
              onClick={() => setLang(item.code)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="field">
          <label className="label">العنوان الرئيسي</label>
          <input
            className="input"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={landing[lang]?.headline ?? ''}
            onChange={(e) => setLandingField('headline', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">السطر الفرعي</label>
          <input
            className="input"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={landing[lang]?.subline ?? ''}
            onChange={(e) => setLandingField('subline', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">النصّ التعريفي</label>
          <textarea
            className="textarea"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={landing[lang]?.body ?? ''}
            onChange={(e) => setLandingField('body', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">نصّ زر التنزيل</label>
          <input
            className="input"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={landing[lang]?.cta ?? ''}
            onChange={(e) => setLandingField('cta', e.target.value)}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------- التطبيق */}
      <div className="card mb-16">
        <div className="card-title">📱 نسخة التطبيق</div>
        <p className="hint mb-12">
          من كان إصداره أقدم من «أدنى إصدار» تظهر له شاشة إجبارية لا يُستخدم التطبيق قبل
          التحديث. ومن كان أقدم من «آخر إصدار» فقط تظهر له لافتة يمكن تأجيلها.
        </p>
        <div className="row-3">
          <div className="field">
            <label className="label">آخر إصدار</label>
            <input
              className="input ltr"
              value={String(form.latest_version ?? '')}
              onChange={(e) => set('latest_version', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">أدنى إصدار مسموح</label>
            <input
              className="input ltr"
              value={String(form.min_version ?? '')}
              onChange={(e) => set('min_version', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">حجم الملف</label>
            <input className="input ltr" value={`${data.config.app.apk_size_mb} MB`} readOnly />
          </div>
        </div>
        <div className="field">
          <label className="label">رابط التنزيل</label>
          <input
            className="input ltr"
            value={String(form.apk_url ?? '')}
            onChange={(e) => set('apk_url', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">بصمة الملف (SHA-256)</label>
          <input className="input ltr" value={data.config.app.apk_sha256} readOnly />
          <p className="hint">تُعرض في صفحة التنزيل ليطمئنّ المستخدم أن الملف لم يُعبَث به.</p>
        </div>
        <div className="field">
          <label className="label">رسالة التحديث (عربي)</label>
          <input
            className="input"
            value={String(form.update_message_ar ?? '')}
            onChange={(e) => set('update_message_ar', e.target.value)}
            placeholder="نسخة جديدة فيها تحسينات وإصلاحات"
          />
        </div>
      </div>

      {/* ---------------------------------------------------------- الدعم */}
      <div className="card">
        <div className="card-title">💬 الدعم</div>
        <div className="row-2">
          <div className="field">
            <label className="label">واتساب الدعم</label>
            <input
              className="input ltr"
              value={String(form.support_whatsapp ?? '')}
              onChange={(e) => set('support_whatsapp', e.target.value)}
              placeholder="+963994123456"
            />
          </div>
          <div className="field">
            <label className="label">بريد الدعم</label>
            <input
              className="input ltr"
              value={String(form.support_email ?? '')}
              onChange={(e) => set('support_email', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** معاينة مربّعة للشعار أو الأيقونة — أو حرف العلامة حين لا صورة. */
function BrandPreview({ src, fallback }: { src: string | null; fallback: string }) {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        flex: '0 0 64px',
        borderRadius: 14,
        border: '1px solid var(--line)',
        background: src ? 'var(--surface-2)' : 'var(--brand)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 26 }}>{fallback}</span>
      )}
    </div>
  );
}

function Num({
  form,
  set,
  k,
  label,
}: {
  form: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  k: string;
  label: string;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        className="input ltr"
        type="number"
        min={0}
        value={String(form[k] ?? '')}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  );
}

function emptyLanding(): LandingText {
  return { headline: '', subline: '', body: '', cta: '', features: [] };
}
