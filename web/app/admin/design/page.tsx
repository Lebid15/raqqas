'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import {
  Notice,
  Spinner,
  useAdmin,
  useApi,
  type AdminConfigPayload,
  type ContrastWarning,
} from '@/lib/admin';

/**
 * محرّر التصميم (plan2 §4).
 *
 * القاعدة: الأدمن يغيّر **القيم** لا **البنية** — لون وخط واستدارة وظلال،
 * ولا يحرّك موقع زر ولا يغيّر عدد أعمدة. هذا يحمي التطبيق من الانكسار.
 *
 * وكل تغيير يُفحَص تباينه قبل الحفظ: لون فاتح على أبيض يجعل التطبيق غير
 * قابل للاستخدام لكل الناس دفعة واحدة.
 */

type Preset = {
  key: string;
  name_ar: string;
  light: Record<string, string>;
  dark: Record<string, string>;
};

const RADIUS_LABELS: Record<string, string> = {
  sm: 'صغيرة (الحقول)',
  md: 'متوسطة (البطاقات)',
  lg: 'كبيرة (الفقاعات)',
  xl: 'كبيرة جدًا (النوافذ)',
};

const SHADOW_LABELS: Record<string, string> = {
  flat: 'بلا ظلال',
  soft: 'ناعمة',
  strong: 'قوية',
};

const DENSITY_LABELS: Record<string, string> = {
  compact: 'مضغوطة',
  normal: 'عادية',
  comfortable: 'مريحة',
};

export default function DesignPage() {
  const { toast } = useAdmin();
  const { data, loading, reload } = useApi<AdminConfigPayload>('/admin/app-config');
  const { data: presets } = useApi<Preset[]>('/theme-presets');

  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [light, setLight] = useState<Record<string, string>>({});
  const [dark, setDark] = useState<Record<string, string>>({});
  const [font, setFont] = useState('Cairo');
  const [scale, setScale] = useState(1);
  const [radius, setRadius] = useState<Record<string, number>>({});
  const [shadows, setShadows] = useState('soft');
  const [density, setDensity] = useState('normal');
  const [darkEnabled, setDarkEnabled] = useState(true);

  const [warnings, setWarnings] = useState<ContrastWarning[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // نملأ النموذج من الخادم مرة واحدة عند وصول البيانات
  useEffect(() => {
    if (!data) return;
    setLight(data.config.theme.light);
    setDark(data.config.theme.dark);
    setFont(data.config.theme.font.family);
    setScale(data.config.theme.font.scale);
    setRadius(data.config.theme.radius);
    setShadows(data.config.theme.shadows);
    setDensity(data.config.theme.density);
    setDarkEnabled(data.config.theme.darkModeEnabled);
    setWarnings(data.warnings);
    setDirty(false);
  }, [data]);

  const colors = mode === 'light' ? light : dark;
  const setColors = mode === 'light' ? setLight : setDark;

  // فحص التباين أثناء التحرير — قبل الحفظ لا بعده
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ warnings: ContrastWarning[] }>('/admin/theme-check', {
          method: 'POST',
          body: { light, dark },
        });
        setWarnings(result.warnings);
      } catch {
        /* الفحص مساعد لا حاسم */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [light, dark, dirty]);

  const preview = useMemo(() => buildPreview(colors, radius), [colors, radius]);

  const change = (key: string, value: string) => {
    setColors((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const applyPreset = (preset: Preset) => {
    setLight((current) => ({ ...current, ...preset.light }));
    setDark((current) => ({ ...current, ...preset.dark }));
    setDirty(true);
    toast(`طُبّقت سمة «${preset.name_ar}» — لم تُحفظ بعد`);
  };

  const save = async () => {
    setBusy(true);
    try {
      const result = await api<AdminConfigPayload>('/admin/app-config', {
        method: 'PATCH',
        body: {
          theme_light: light,
          theme_dark: dark,
          font_family: font,
          font_scale: scale,
          radius,
          shadows,
          density,
          dark_mode_enabled: darkEnabled,
        },
      });
      setWarnings(result.warnings);
      setDirty(false);
      toast('✅ حُفظ — سيصل التطبيقات عند فتحها التالي');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!confirm('استعادة كل قيم التصميم الافتراضية؟')) return;
    const green = presets?.find((p) => p.key === 'green');
    if (green) applyPreset(green);
    setFont('Cairo');
    setScale(1);
    setRadius({ sm: 8, md: 12, lg: 18, xl: 24, full: 999 });
    setShadows('soft');
    setDensity('normal');
    setDirty(true);
  };

  if (loading && !data) return <Spinner />;
  if (!data) return <Notice tone="danger">تعذّر تحميل الإعدادات.</Notice>;

  const blocking = warnings.filter((w) => w.level === 'error');

  return (
    <div>
      <div className="row-between mb-8">
        <div>
          <h1 className="page-title">🎨 محرّر التصميم</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            نسخة الإعدادات {data.config.version} · التغيير يصل التطبيقات بلا تحديث
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={restore}>
            ↺ الافتراضي
          </button>
          <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
            {busy ? 'جاري الحفظ…' : dirty ? 'حفظ التغييرات' : 'محفوظ'}
          </button>
        </div>
      </div>

      {blocking.length > 0 ? (
        <div className="mb-16">
          <Notice tone="danger">
            <b>{blocking.length} مشكلة قراءة:</b>
            <ul style={{ marginTop: 6 }}>
              {blocking.slice(0, 5).map((w, i) => (
                <li key={i} style={{ fontSize: 12.5, fontWeight: 600 }}>
                  • {w.message} ({w.mode === 'light' ? 'نهاري' : 'ليلي'})
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : dirty ? (
        <div className="mb-16">
          <Notice tone="success">كل الألوان مقروءة ✓</Notice>
        </div>
      ) : null}

      {/* السمات الجاهزة */}
      <div className="card mb-16">
        <div className="card-title">⚡ سمات جاهزة</div>
        <div className="preset-grid">
          {(presets ?? []).map((preset) => (
            <button key={preset.key} className="preset" onClick={() => applyPreset(preset)}>
              <span className="preset-dots">
                <span className="preset-dot" style={{ background: preset.light.brand }} />
                <span className="preset-dot" style={{ background: preset.light.brand50 }} />
                <span
                  className="preset-dot"
                  style={{ background: preset.light.gold ?? '#E8940C' }}
                />
              </span>
              {preset.name_ar}
            </button>
          ))}
        </div>
      </div>

      <div className="row-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {/* الألوان */}
          <div className="card">
            <div className="row-between mb-12">
              <div className="card-title" style={{ marginBottom: 0 }}>
                الألوان
              </div>
              <div className="tabs" style={{ border: 0, margin: 0 }}>
                <button
                  className={`tab${mode === 'light' ? ' is-active' : ''}`}
                  onClick={() => setMode('light')}
                >
                  ☀️ نهاري
                </button>
                <button
                  className={`tab${mode === 'dark' ? ' is-active' : ''}`}
                  onClick={() => setMode('dark')}
                >
                  🌙 ليلي
                </button>
              </div>
            </div>

            {data.meta.color_groups.map((group) => (
              <div key={group.key} className="mb-16">
                <div className="label">{group.label_ar}</div>
                <div className="swatch-grid">
                  {group.keys.map((key) => (
                    <label key={key} className="swatch">
                      <input
                        type="color"
                        value={colors[key] ?? '#000000'}
                        onChange={(e) => change(key, e.target.value.toUpperCase())}
                      />
                      <span className="swatch-info">
                        <span className="swatch-key">{key}</span>
                        <span className="swatch-hex">{colors[key]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* الخط والأبعاد */}
          <div className="card">
            <div className="card-title">الخط والأبعاد</div>

            <div className="field">
              <label className="label">الخط</label>
              <select
                className="select"
                value={font}
                onChange={(e) => { setFont(e.target.value); setDirty(true); }}
              >
                {data.meta.fonts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <p className="hint">الخطوط محزومة داخل التطبيق — لا يمكن إضافة خط من الإنترنت.</p>
            </div>

            <div className="field">
              <label className="label">حجم الخط ({Math.round(scale * 100)}%)</label>
              <input
                type="range"
                min={0.85}
                max={1.3}
                step={0.05}
                value={scale}
                style={{ width: '100%' }}
                onChange={(e) => { setScale(Number(e.target.value)); setDirty(true); }}
              />
            </div>

            <div className="field">
              <label className="label">الاستدارة</label>
              {Object.keys(RADIUS_LABELS).map((key) => (
                <div key={key} className="row mb-8">
                  <span className="txt-sm" style={{ width: 130, fontWeight: 700 }}>
                    {RADIUS_LABELS[key]}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={radius[key] ?? 0}
                    className="grow"
                    onChange={(e) => {
                      setRadius((r) => ({ ...r, [key]: Number(e.target.value) }));
                      setDirty(true);
                    }}
                  />
                  <span className="bold txt-sm ltr" style={{ width: 42 }}>
                    {radius[key] ?? 0}px
                  </span>
                </div>
              ))}
            </div>

            <div className="row-2">
              <div className="field">
                <label className="label">الظلال</label>
                <select
                  className="select"
                  value={shadows}
                  onChange={(e) => { setShadows(e.target.value); setDirty(true); }}
                >
                  {data.meta.shadows.map((key) => (
                    <option key={key} value={key}>{SHADOW_LABELS[key] ?? key}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">الكثافة</label>
                <select
                  className="select"
                  value={density}
                  onChange={(e) => { setDensity(e.target.value); setDirty(true); }}
                >
                  {data.meta.densities.map((key) => (
                    <option key={key} value={key}>{DENSITY_LABELS[key] ?? key}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={darkEnabled}
                onChange={(e) => { setDarkEnabled(e.target.checked); setDirty(true); }}
              />
              <span className="bold txt-sm">تفعيل الوضع الليلي في التطبيق</span>
            </label>
          </div>
        </div>

        {/* المعاينة */}
        <div style={{ position: 'sticky', top: 74 }}>
          <div className="card">
            <div className="card-title">📱 معاينة حيّة</div>
            <PhonePreview colors={colors} radius={radius} scale={scale} style={preview} />
            <p className="hint mt-12">
              معاينة تقريبية لشكل التطبيق بالقيم الحالية — الوضع{' '}
              {mode === 'light' ? 'النهاري' : 'الليلي'}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ المعاينة */

function buildPreview(colors: Record<string, string>, radius: Record<string, number>) {
  return {
    background: colors.bg,
    borderRadius: (radius.md ?? 12) + 6,
  } as React.CSSProperties;
}

function PhonePreview({
  colors,
  radius,
  scale,
  style,
}: {
  colors: Record<string, string>;
  radius: Record<string, number>;
  scale: number;
  style: React.CSSProperties;
}) {
  const r = (key: string) => (radius[key] ?? 12) + 'px';
  const f = (size: number) => Math.round(size * scale) + 'px';

  return (
    <div style={{ ...style, overflow: 'hidden', border: `1px solid ${colors.line}` }}>
      {/* الترويسة */}
      <div style={{ background: colors.brand, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 10, background: '#fff',
              color: colors.brand, display: 'grid', placeItems: 'center',
              fontSize: f(17), fontWeight: 900,
            }}
          >
            س
          </div>
          <div>
            <div style={{ color: colors.onBrand, fontSize: f(15), fontWeight: 900 }}>سوق الرقة</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: f(10) }}>
              بيع واشترِ داخل مدينتك
            </div>
          </div>
        </div>
        <div
          style={{
            background: colors.surface, borderRadius: 999, padding: '9px 14px',
            marginTop: 10, color: colors.ink3, fontSize: f(13),
          }}
        >
          🔎 ماذا تبحث؟
        </div>
      </div>

      {/* بطاقة إعلان */}
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                flex: 1, background: colors.surface, border: `1px solid ${colors.line}`,
                borderRadius: r('md'), overflow: 'hidden',
              }}
            >
              <div
                style={{
                  aspectRatio: '4/3', background: colors.brand50,
                  display: 'grid', placeItems: 'center', fontSize: 30,
                }}
              >
                {i === 0 ? '📱' : '🚗'}
              </div>
              <div style={{ padding: 9 }}>
                <div style={{ fontSize: f(12), fontWeight: 700, color: colors.ink }}>
                  {i === 0 ? 'آيفون 15 برو' : 'كيا ريو 2015'}
                </div>
                <div style={{ fontSize: f(14), fontWeight: 900, color: colors.brandText, marginTop: 3 }}>
                  {i === 0 ? '1,000,000 ل.س' : '8,500 ل.س'}
                </div>
                <div style={{ fontSize: f(10), color: colors.ink3, marginTop: 3 }}>📍 المشلب</div>
              </div>
            </div>
          ))}
        </div>

        {/* أزرار */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div
            style={{
              flex: 1, background: colors.brand, color: colors.onBrand,
              borderRadius: r('md'), padding: '10px', textAlign: 'center',
              fontSize: f(13), fontWeight: 800,
            }}
          >
            💬 تواصل
          </div>
          <div
            style={{
              background: colors.brand50, color: colors.brandText,
              borderRadius: r('md'), padding: '10px 16px',
              fontSize: f(13), fontWeight: 800,
            }}
          >
            ♡
          </div>
        </div>

        {/* شارات الحالة */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <Pill bg={colors.gold} fg={colors.onGold} text="⭐ مميز" />
          <Pill bg={colors.success50} fg={colors.success} text="منشور" />
          <Pill bg={colors.danger50} fg={colors.danger} text="مرفوض" />
          <Pill bg={colors.gold50} fg="#8A5A00" text="قيد المراجعة" />
        </div>
      </div>

      {/* الشريط السفلي */}
      <div
        style={{
          background: colors.surface, borderTop: `1px solid ${colors.line}`,
          display: 'flex', justifyContent: 'space-around', padding: '10px 0',
          fontSize: f(10), fontWeight: 700,
        }}
      >
        <span style={{ color: colors.brandText }}>🏠 الرئيسية</span>
        <span style={{ color: colors.ink3 }}>📂 الأقسام</span>
        <span style={{ color: colors.ink3 }}>❤ المفضلة</span>
        <span style={{ color: colors.ink3 }}>👤 حسابي</span>
      </div>
    </div>
  );
}

function Pill({ bg, fg, text }: { bg: string; fg: string; text: string }) {
  return (
    <span
      style={{
        background: bg, color: fg, borderRadius: 999,
        padding: '3px 10px', fontSize: 11, fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}
