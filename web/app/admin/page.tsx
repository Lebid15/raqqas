'use client';

import Link from 'next/link';
import React from 'react';

import { Notice, Spinner, useApi, waitLabel } from '@/lib/admin';

type Dashboard = {
  listings: { total: number; by_status: Record<string, number>; today: number; week: number };
  users: { total: number; today: number; week: number; suspended: number };
  reports: { open: number; total: number };
  review: {
    pending_count: number;
    oldest_wait_minutes: number;
    avg_wait_minutes_7d: number | null;
    over_threshold: boolean;
  };
  top_categories: { category__name_ar: string; category__parent__name_ar: string | null; n: number }[];
};

export default function DashboardPage() {
  const { data, loading } = useApi<Dashboard>('/admin/dashboard');

  if (loading && !data) return <Spinner />;
  if (!data) return <Notice tone="danger">تعذّر تحميل الأرقام.</Notice>;

  return (
    <div>
      <h1 className="page-title">لوحة الأرقام</h1>
      <p className="page-sub">نظرة سريعة على حال السوق اليوم</p>

      {/* التنبيه الأهم: إعلانات تنتظرك */}
      {data.review.pending_count > 0 ? (
        <div className="mb-16">
          <Notice tone={data.review.oldest_wait_minutes > 120 ? 'warn' : 'info'}>
            <b>{data.review.pending_count}</b> إعلانًا بانتظار المراجعة — أقدمها منذ{' '}
            <b>{waitLabel(data.review.oldest_wait_minutes)}</b>.{' '}
            <Link href="/admin/review" style={{ textDecoration: 'underline', fontWeight: 800 }}>
              ابدأ المراجعة ←
            </Link>
          </Notice>
        </div>
      ) : null}

      {/*
        مؤشّر زمن الانتظار (plan2 §8.6): إن تجاوز المتوسط ساعتين فالمراجعة
        اليدوية الكاملة صارت عبئًا — وباب الخروج جاهز بتغيير إعداد واحد.
      */}
      {data.review.over_threshold ? (
        <div className="mb-16">
          <Notice tone="warn">
            متوسط زمن الانتظار هذا الأسبوع <b>{waitLabel(data.review.avg_wait_minutes_7d)}</b> —
            أطول من ساعتين. البائعون يظنّون أن التطبيق لا يعمل حين يطول الانتظار.
            فكّر في تحويل نمط المراجعة إلى «الأعضاء الجدد فقط» من{' '}
            <Link href="/admin/settings" style={{ textDecoration: 'underline', fontWeight: 800 }}>
              الإعدادات
            </Link>
            .
          </Notice>
        </div>
      ) : null}

      <div className="stat-grid mb-16">
        <Stat
          icon="⏳"
          tone="var(--gold-50)"
          value={data.listings.by_status.pending ?? 0}
          label="قيد المراجعة"
        />
        <Stat
          icon="✅"
          tone="var(--success-50)"
          value={data.listings.by_status.published ?? 0}
          label="إعلان منشور"
        />
        <Stat icon="👥" tone="var(--info-50)" value={data.users.total} label="مستخدم" />
        <Stat icon="🚩" tone="var(--danger-50)" value={data.reports.open} label="بلاغ مفتوح" />
      </div>

      <div className="row-2 mb-16">
        <div className="card">
          <div className="card-title">📈 النشاط</div>
          <Line label="إعلانات اليوم" value={data.listings.today} />
          <Line label="إعلانات هذا الأسبوع" value={data.listings.week} />
          <Line label="مستخدمون جدد اليوم" value={data.users.today} />
          <Line label="مستخدمون جدد هذا الأسبوع" value={data.users.week} />
        </div>

        <div className="card">
          <div className="card-title">⏱️ سرعة المراجعة</div>
          <Line label="بانتظار المراجعة" value={data.review.pending_count} />
          <Line label="أطول انتظار حاليًا" value={waitLabel(data.review.oldest_wait_minutes)} />
          <Line
            label="متوسط الانتظار (7 أيام)"
            value={waitLabel(data.review.avg_wait_minutes_7d)}
          />
          <Line label="حسابات موقوفة" value={data.users.suspended} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">🏆 أكثر الأقسام نشاطًا</div>
        {data.top_categories.length === 0 ? (
          <p className="muted txt-sm">لا توجد إعلانات منشورة بعد.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>القسم الرئيسي</th>
                  <th>عدد الإعلانات</th>
                </tr>
              </thead>
              <tbody>
                {data.top_categories.map((row, index) => (
                  <tr key={index}>
                    <td className="bold">{row.category__name_ar}</td>
                    <td className="muted">{row.category__parent__name_ar ?? '—'}</td>
                    <td className="bold">{row.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="stat">
      <div className="stat-icon" style={{ background: tone }}>
        {icon}
      </div>
      <div className="stat-num">{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="row-between"
      style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}
    >
      <span className="txt-sm" style={{ fontWeight: 700 }}>
        {label}
      </span>
      <span className="bold">{value}</span>
    </div>
  );
}
