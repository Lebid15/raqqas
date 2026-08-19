'use client';

import React, { useState } from 'react';

import { API_URL } from '@/lib/api';
import { useLegalLang } from '../legal/LegalPage';
import styles from '../legal/legal.module.css';
import type { Lang } from '../legal/content';

/**
 * نموذج حذف الحساب من الويب.
 *
 * ═══ لماذا يوجد هذا أصلًا؟ ═══
 *
 * سياسة «حذف بيانات المستخدم» في Google Play تشترط مسارين لا مسارًا واحدًا:
 * داخل التطبيق، **ورابطًا عامًّا على الويب** يصل إليه من أزال التطبيق أو لم
 * يعد يملك الجهاز. وهذه الصفحة هي المسار الثاني.
 *
 * ═══ ولماذا نطلب كلمة المرور؟ ═══
 *
 * لأن صفحة تحذف حسابًا برقم هاتف وحده تعني أن أي شخص يعرف رقمك يستطيع محو
 * حسابك وإعلاناتك. النموذج يُثبت الهوية أولًا (نفس تحقّق تسجيل الدخول) ثم
 * يحذف — فيبقى المسار مفتوحًا لصاحبه ومغلقًا على غيره.
 */

const TEXT: Record<Lang, Record<string, string>> = {
  ar: {
    heading: 'احذف حسابك من هنا',
    intro:
      'اكتب رقم هاتفك وكلمة مرورك لتأكيد أنك صاحب الحساب. الحذف فوري ونهائي ولا يمكن التراجع عنه.',
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    submit: 'احذف حسابي نهائيًا',
    busy: 'جاري الحذف…',
    done: '✅ حُذف حسابك وكل إعلاناتك وصورك نهائيًا. شكرًا لوقتك معنا.',
    inApp:
      'إن كان التطبيق ما يزال مثبَّتًا لديك، الطريق الأسرع: «حسابي ‹ حذف حسابي».',
    generic: 'تعذّر إتمام الطلب. تأكّد من الرقم وكلمة المرور.',
  },
  tr: {
    heading: 'Hesabinizi buradan silin',
    intro:
      'Hesap sahibi oldugunuzu dogrulamak icin telefon numaranizi ve sifrenizi yazin. Silme aninda, kalici ve geri alinamazdir.',
    phone: 'Telefon numarasi',
    password: 'Sifre',
    submit: 'Hesabimi kalici olarak sil',
    busy: 'Siliniyor…',
    done: '✅ Hesabiniz, tum ilanlariniz ve fotograflariniz kalici olarak silindi. Tesekkurler.',
    inApp: 'Uygulama hala kuruluysa en hizli yol: «Hesabim › Hesabimi sil».',
    generic: 'Islem tamamlanamadi. Numara ve sifreyi kontrol edin.',
  },
  en: {
    heading: 'Delete your account here',
    intro:
      'Enter your phone number and password to confirm you own the account. Deletion is immediate, permanent and irreversible.',
    phone: 'Phone number',
    password: 'Password',
    submit: 'Delete my account permanently',
    busy: 'Deleting…',
    done: '✅ Your account, all your listings and photos have been permanently deleted. Thank you.',
    inApp: 'If the app is still installed, the fastest route is Account › Delete my account.',
    generic: 'The request could not be completed. Check the number and password.',
  },
};

export function DeleteForm() {
  const lang = useLegalLang();
  const text = TEXT[lang];
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Language': lang },
        body: JSON.stringify({ phone, password }),
      });
      if (!response.ok) {
        // رسالة الخادم تصل جاهزة بلغة الطلب — نعرضها كما هي
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message || text.generic);
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.generic);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className={styles.section}>
        <div className={styles.ok}>{text.done}</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{text.heading}</h2>
      <div className={styles.warn}>{text.intro}</div>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.label} htmlFor="phone">
          {text.phone}
        </label>
        <input
          id="phone"
          className={styles.input}
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <label className={styles.label} htmlFor="password">
          {text.password}
        </label>
        <input
          id="password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <p className={styles.error}>{error}</p> : null}

        <button className={styles.danger} type="submit" disabled={busy}>
          {busy ? text.busy : text.submit}
        </button>
      </form>

      <p className={styles.updated} style={{ marginTop: 12 }}>
        {text.inApp}
      </p>
    </section>
  );
}
