'use client';

import React, { useState } from 'react';

import { api } from '@/lib/api';
import { Empty, Notice, Spinner, StatusPill, useAdmin, useApi, STATUS_LABELS } from '@/lib/admin';

type AdminListing = {
  id: number;
  title: string;
  price_text: string;
  status: string;
  is_featured: boolean;
  thumb: string | null;
  photos_count: number;
  category: { name: string; parent: { name: string } | null } | null;
  city: { name: string } | null;
  address: string;
  seller: { id: number; name: string; phone: string };
  views_count: number;
  reports_count: number;
  created_at: string;
  time_text: string;
};

type Page = { results: AdminListing[]; count: number; page: number; has_next: boolean };

const FILTERS = ['', 'published', 'pending', 'rejected', 'expired', 'suspended'];

export default function ListingsPage() {
  const { toast } = useAdmin();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);

  const { data, loading, reload } = useApi<Page>('/admin/listings', {
    status: status || undefined,
    q: query || undefined,
    page,
  });

  const act = async (action: 'approve' | 'reject' | 'suspend', ids: number[], reason = '') => {
    if (ids.length === 0) return;
    if (action !== 'approve' && !reason) {
      const entered = prompt(action === 'reject' ? 'سبب الرفض:' : 'سبب الإيقاف:');
      if (!entered) return;
      reason = entered;
    }
    try {
      await api(`/admin/listings/${action}`, { method: 'POST', body: { ids, reason } });
      toast(`تم على ${ids.length} إعلان`);
      setSelected([]);
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  const toggleFeatured = async (listing: AdminListing) => {
    try {
      await api(`/admin/listings/${listing.id}/featured`, { method: 'POST', body: {} });
      toast(listing.is_featured ? 'أُلغي التمييز' : '⭐ صار مميّزًا');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  return (
    <div>
      <h1 className="page-title">📋 كل الإعلانات</h1>
      <p className="page-sub">{data ? `${data.count} إعلانًا` : '…'}</p>

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        {FILTERS.map((value) => (
          <button
            key={value || 'all'}
            className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setStatus(value); setPage(1); }}
          >
            {value ? STATUS_LABELS[value] : 'الكل'}
          </button>
        ))}
        <form
          className="row grow"
          onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}
        >
          <input
            className="input"
            placeholder="ابحث بالعنوان أو اسم البائع أو رقمه…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm">بحث</button>
        </form>
      </div>

      {selected.length > 0 ? (
        <div className="card mb-16">
          <div className="row-between">
            <span className="bold">{selected.length} إعلانًا محدّدًا</span>
            <div className="row">
              <button className="btn btn-success btn-sm" onClick={() => act('approve', selected)}>
                ✅ نشر
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => act('reject', selected)}>
                ✕ رفض
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>
                إلغاء التحديد
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <Spinner />
      ) : !data || data.results.length === 0 ? (
        <Empty icon="📭" title="لا توجد إعلانات" text="جرّب مرشّحًا آخر أو كلمة بحث مختلفة." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      checked={selected.length === data.results.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? data.results.map((r) => r.id) : [])
                      }
                    />
                  </th>
                  <th>الإعلان</th>
                  <th>البائع</th>
                  <th>الحالة</th>
                  <th>المشاهدات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((listing) => (
                  <tr key={listing.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(listing.id)}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, listing.id]
                              : current.filter((id) => id !== listing.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="row">
                        {listing.thumb ? (
                          <img
                            src={listing.thumb}
                            alt=""
                            style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 46, height: 46, borderRadius: 8,
                              background: 'var(--brand-50)', display: 'grid', placeItems: 'center',
                            }}
                          >
                            📦
                          </div>
                        )}
                        <div>
                          <div className="bold">
                            {listing.is_featured ? '⭐ ' : ''}
                            {listing.title}
                          </div>
                          <div className="muted txt-sm">
                            {listing.price_text} · {listing.category?.name ?? '—'} ·{' '}
                            {[listing.city?.name, listing.address].filter(Boolean).join(' · ') || '—'} · {listing.time_text}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="bold txt-sm">{listing.seller.name}</div>
                      <div className="muted txt-sm ltr" style={{ textAlign: 'start' }}>
                        {listing.seller.phone}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={listing.status} />
                      {listing.reports_count > 0 ? (
                        <div className="txt-sm" style={{ color: 'var(--danger)', fontWeight: 800 }}>
                          🚩 {listing.reports_count}
                        </div>
                      ) : null}
                    </td>
                    <td className="bold">{listing.views_count}</td>
                    <td>
                      <div className="row" style={{ gap: 5 }}>
                        {listing.status !== 'published' ? (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => act('approve', [listing.id])}
                          >
                            نشر
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => act('suspend', [listing.id])}
                          >
                            إيقاف
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleFeatured(listing)}>
                          {listing.is_featured ? '★' : '☆'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-between mt-16">
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              → السابق
            </button>
            <span className="muted txt-sm">صفحة {data.page}</span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!data.has_next}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي ←
            </button>
          </div>
        </>
      )}
    </div>
  );
}
