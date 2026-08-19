'use client';

import React, { useState } from 'react';

import { API_URL } from '@/lib/api';
import type { LandingConfig } from './page';

type Lang = 'ar' | 'tr' | 'en';

const LANGS: { code: Lang; label: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
];

const UI: Record<Lang, Record<string, string>> = {
  ar: {
    download: 'حمّل التطبيق',
    size: 'الحجم',
    version: 'الإصدار',
    installTitle: 'كيف أثبّت التطبيق؟',
    step1: 'اضغط زر التحميل — سينزل ملف باسم souq-raqqa.apk',
    step2: 'افتح الملف بعد انتهاء التنزيل',
    step3: 'سيحذّرك أندرويد أن المصدر غير معروف — اضغط «الإعدادات» ثم فعّل «السماح من هذا المصدر»',
    step4: 'ارجع واضغط «تثبيت» — وانتهى',
    whyWarning: 'لماذا يحذّرني أندرويد؟',
    whyWarningText:
      'لأن التطبيق يُحمَّل من موقعنا مباشرة لا من متجر جوجل. التحذير روتيني ويظهر لكل تطبيق خارج المتجر. للاطمئنان: بصمة الملف مكتوبة بالأسفل، ويمكنك مطابقتها.',
    checksum: 'بصمة الملف (SHA-256)',
    checksumHint: 'تتغيّر كليًا لو عُبث بالملف — طابقها إن أردت التأكّد.',
    soon: 'التطبيق قيد التجهيز — عُد قريبًا.',
    support: 'تواصل معنا',
  },
  tr: {
    download: 'Uygulamayı indir',
    size: 'Boyut',
    version: 'Sürüm',
    installTitle: 'Nasıl kurulur?',
    step1: 'İndir düğmesine bas — souq-raqqa.apk dosyası inecek',
    step2: 'İndirme bitince dosyayı aç',
    step3: 'Android bilinmeyen kaynak uyarısı verecek — «Ayarlar» → «Bu kaynağa izin ver»',
    step4: 'Geri dön ve «Yükle» de — bitti',
    whyWarning: 'Android neden uyarıyor?',
    whyWarningText:
      'Uygulama Google Play yerine doğrudan sitemizden indirildiği için. Bu uyarı mağaza dışı tüm uygulamalarda çıkar. Güvence için dosya parmak izi aşağıda.',
    checksum: 'Dosya parmak izi (SHA-256)',
    checksumHint: 'Dosya değiştirilirse tamamen değişir.',
    soon: 'Uygulama hazırlanıyor — yakında.',
    support: 'Bize ulaşın',
  },
  en: {
    download: 'Download the app',
    size: 'Size',
    version: 'Version',
    installTitle: 'How to install',
    step1: 'Tap download — a file named souq-raqqa.apk will download',
    step2: 'Open the file once it finishes',
    step3: 'Android will warn about an unknown source — tap Settings, then allow this source',
    step4: 'Go back and tap Install — done',
    whyWarning: 'Why does Android warn me?',
    whyWarningText:
      'Because the app is downloaded from our site rather than Google Play. This warning appears for every app installed outside the store. The file checksum is below if you want to verify it.',
    checksum: 'File checksum (SHA-256)',
    checksumHint: 'It changes completely if the file is tampered with.',
    soon: 'The app is being prepared — check back soon.',
    support: 'Contact us',
  },
};

export function Landing({ config }: { config: LandingConfig | null }) {
  const [lang, setLang] = useState<Lang>('ar');
  const dir = LANGS.find((l) => l.code === lang)!.dir;
  const t = UI[lang];
  const text = config?.landing?.[lang];
  const app = config?.app;
  const available = Boolean(app?.apk_url);

  const track = () => {
    // عدّاد تنزيلات بسيط — بديلنا عن إحصاءات المتجر (plan2 §7.2)
    void fetch(`${API_URL}/downloads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: app?.latest_version ?? '', source: 'landing' }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <div dir={dir} style={{ minHeight: '100vh' }}>
      {/* شريط اللغات */}
      <div style={{ background: 'var(--ink)', padding: '8px 14px' }}>
        <div
          style={{
            maxWidth: 720, margin: '0 auto', display: 'flex',
            gap: 6, justifyContent: 'center',
          }}
        >
          {LANGS.map((item) => (
            <button
              key={item.code}
              onClick={() => setLang(item.code)}
              style={{
                padding: '4px 14px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 800,
                color: lang === item.code ? '#111C18' : 'rgba(255,255,255,.7)',
                background: lang === item.code ? '#fff' : 'transparent',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* الترويسة */}
      <header
        style={{
          background: 'linear-gradient(160deg, var(--brand), var(--brand-700))',
          color: '#fff',
          padding: '44px 20px 38px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 68, height: 68, borderRadius: 20, background: '#fff',
            color: 'var(--brand)', display: 'grid', placeItems: 'center',
            fontSize: 34, fontWeight: 900, margin: '0 auto 14px',
          }}
        >
          س
        </div>
        <h1 style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.4 }}>
          {text?.headline || 'سوق الرقة'}
        </h1>
        <p style={{ fontSize: 15, opacity: 0.9, marginTop: 6, fontWeight: 600 }}>
          {text?.subline || ''}
        </p>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 48px' }}>
        {/* بطاقة التنزيل */}
        <div
          className="card"
          style={{ marginTop: -22, position: 'relative', zIndex: 2, boxShadow: 'var(--sh-lg)' }}
        >
          {text?.body ? (
            <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.9, marginBottom: 16 }}>
              {text.body}
            </p>
          ) : null}

          {available ? (
            <>
              <a
                className="btn btn-primary btn-block btn-lg"
                href={app!.apk_url}
                onClick={track}
                download
              >
                ⬇️ {text?.cta || t.download}
              </a>
              <div
                className="row"
                style={{ justifyContent: 'center', gap: 16, marginTop: 12 }}
              >
                <span className="muted txt-sm">
                  {t.size}: <b>{app!.apk_size_mb} MB</b>
                </span>
                <span className="muted txt-sm">
                  {t.version}: <b className="ltr">{app!.latest_version}</b>
                </span>
              </div>
            </>
          ) : (
            <div className="notice notice-info">
              <span>⏳</span>
              <span>{t.soon}</span>
            </div>
          )}
        </div>

        {/* المزايا */}
        {text?.features?.length ? (
          <div className="stack mt-24">
            {text.features.map((feature, index) => (
              <div key={index} className="card">
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{feature.icon}</span>
                  <span>
                    <span className="bold" style={{ display: 'block', fontSize: 15 }}>
                      {feature.title}
                    </span>
                    <span className="muted txt-sm">{feature.text}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* خطوات التثبيت */}
        {available ? (
          <div className="card mt-24">
            <div className="card-title">📲 {t.installTitle}</div>
            <ol style={{ paddingInlineStart: 0 }}>
              {[t.step1, t.step2, t.step3, t.step4].map((step, index) => (
                <li
                  key={index}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '10px 0',
                    borderTop: index === 0 ? 0 : '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      width: 26, height: 26, borderRadius: 999, flexShrink: 0,
                      background: 'var(--brand-50)', color: 'var(--brand-text)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 13, fontWeight: 900,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.8 }}>{step}</span>
                </li>
              ))}
            </ol>

            <div className="notice notice-info mt-16">
              <span>🛡️</span>
              <span>
                <b style={{ display: 'block', marginBottom: 4 }}>{t.whyWarning}</b>
                {t.whyWarningText}
              </span>
            </div>

            <div className="mt-16">
              <div className="label">{t.checksum}</div>
              <div
                className="ltr"
                style={{
                  background: 'var(--ink)', color: 'var(--bg)',
                  borderRadius: 'var(--r)', padding: 12,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 11.5, wordBreak: 'break-all', textAlign: 'start',
                }}
              >
                {app!.apk_sha256}
              </div>
              <p className="hint">{t.checksumHint}</p>
            </div>
          </div>
        ) : null}

        {/* الدعم */}
        {config?.support?.whatsapp ? (
          <div className="txt-c mt-24">
            <a
              className="btn btn-ghost"
              href={`https://wa.me/${config.support.whatsapp.replace(/\D/g, '')}`}
            >
              💬 {t.support}
            </a>
          </div>
        ) : null}

        <p className="muted txt-sm txt-c mt-24">سوق الرقة · {new Date().getFullYear()}</p>
      </main>
    </div>
  );
}
