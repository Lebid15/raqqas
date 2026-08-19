'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { ApiError } from '@/lib/api';
import { Notice, useAdmin } from '@/lib/admin';

export default function LoginPage() {
  const { login } = useAdmin();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
      router.replace('/admin');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'تعذّر تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'linear-gradient(160deg, var(--brand), var(--brand-700))',
      }}
    >
      <form
        onSubmit={submit}
        className="card"
        style={{ width: '100%', maxWidth: 400, padding: 26 }}
      >
        <div className="txt-c mb-16">
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background: 'var(--brand)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              fontWeight: 900,
              margin: '0 auto 12px',
            }}
          >
            س
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>لوحة إدارة سوق الرقة</div>
          <div className="muted txt-sm">للمديرين والمشرفين فقط</div>
        </div>

        {error ? (
          <div className="mb-16">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}

        <div className="field">
          <label className="label">رقم الهاتف</label>
          <input
            className="input ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0994 123 456"
            inputMode="tel"
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label className="label">كلمة المرور</label>
          <input
            className="input ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'جاري الدخول…' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
