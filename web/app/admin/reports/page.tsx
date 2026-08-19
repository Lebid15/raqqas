'use client';

import React, { useState } from 'react';

import { api } from '@/lib/api';
import { Empty, Notice, Spinner, StatusPill, useAdmin, useApi } from '@/lib/admin';

type Report = {
  id: number;
  reason: string;
  reason_display: string;
  note: string;
  created_at: string;
  status: string;
  listing: { id: number; title: string; status: string; reports_count: number };
  reporter: { id: number | null; name: string };
};

type Page = { results: Report[]; count: number; page: number; has_next: boolean };

export default function ReportsPage() {
  const { toast } = useAdmin();
  const [status, setStatus] = useState('open');
  const { data, loading, reload } = useApi<Page>('/admin/reports', { status });

  const resolve = async (report: Report, action: 'resolve' | 'dismiss') => {
    try {
      await api(`/admin/reports/${report.id}/resolve`, { method: 'POST', body: { action } });
      toast(action === 'resolve' ? 'عولج البلاغ' : 'رُفض البلاغ');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  const suspendListing = async (report: Report) => {
    const reason = prompt('سبب إيقاف الإعلان:');
    if (!reason) return;
    try {
      await api('/admin/listings/suspend', {
        method: 'POST',
        body: { ids: [report.listing.id], reason },
      });
      await api(`/admin/reports/${report.id}/resolve`, {
        method: 'POST',
        body: { action: 'resolve' },
      });
      toast('أُوقف الإعلان وعولج البلاغ');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  return (
    <div>
      <h1 className="page-title">🚩 البلاغات</h1>
      <p className="page-sub">
        الحماية في النسخة الأولى تأتي من مراجعة الإعلانات ومن هذه البلاغات — لا توجد
        محادثة داخلية بعد، فلا سجلّ رسائل يُرجَع إليه عند النزاع.
      </p>

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        {[
          { value: 'open', label: 'مفتوحة' },
          { value: 'resolved', label: 'معالَجة' },
          { value: 'dismissed', label: 'مرفوضة' },
        ].map((item) => (
          <button
            key={item.value}
            className={`btn btn-sm ${status === item.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatus(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data || data.results.length === 0 ? (
        <Empty icon="✨" title="لا توجد بلاغات" text="لا شيء يحتاج تدخّلك الآن." />
      ) : (
        <div className="stack">
          {data.results.map((report) => (
            <div key={report.id} className="card">
              <div className="row-between mb-8">
                <div className="row" style={{ gap: 8 }}>
                  <span className="status status-rejected">{report.reason_display}</span>
                  {report.listing.reports_count > 1 ? (
                    <span className="status status-pending">
                      🔁 {report.listing.reports_count} بلاغات على هذا الإعلان
                    </span>
                  ) : null}
                </div>
                <StatusPill status={report.listing.status} />
              </div>

              <div className="bold mb-8" style={{ fontSize: 15 }}>
                {report.listing.title}
              </div>

              {report.note ? (
                <div className="mb-12">
                  <Notice tone="warn">{report.note}</Notice>
                </div>
              ) : null}

              <div className="row-between">
                <span className="muted txt-sm">
                  المُبلِّغ: {report.reporter.name} ·{' '}
                  {new Date(report.created_at).toLocaleString('ar-EG')}
                </span>
                {report.status === 'open' ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => suspendListing(report)}>
                      إيقاف الإعلان
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => resolve(report, 'resolve')}
                    >
                      عولج
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => resolve(report, 'dismiss')}
                    >
                      بلاغ غير صحيح
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
