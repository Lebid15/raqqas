'use client';

import React, { useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { Empty, Notice, Spinner, useAdmin, useApi } from '@/lib/admin';

/**
 * إدارة الأقسام — تعديل الأسماء بثلاث لغات · إضافة أقسام · إخفاء · ترتيب.
 *
 * القائمة تصل مسطّحة من الخادم ونبنيها شجرةً هنا: مستويان فقط (رئيسي وفرعي)،
 * وهو ما تفرضه الخلفية أصلًا.
 */

type Row = {
  id: number;
  parent: number | null;
  slug: string;
  icon: string;
  name_ar: string;
  name_tr: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
  listings_count: number;
  children_count: number;
};

type Draft = Partial<Row> & { name_ar: string };

const LANGS: { key: 'name_ar' | 'name_tr' | 'name_en'; label: string }[] = [
  { key: 'name_ar', label: 'العربية' },
  { key: 'name_tr', label: 'Türkçe' },
  { key: 'name_en', label: 'English' },
];

export default function CategoriesPage() {
  const { toast } = useAdmin();
  const { data, loading, reload } = useApi<Row[]>('/admin/categories');

  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState<{ parent: number | null } | null>(null);
  const [draft, setDraft] = useState<Draft>({ name_ar: '' });
  const [busy, setBusy] = useState(false);

  const tree = useMemo(() => {
    const rows = data ?? [];
    const roots = rows.filter((row) => row.parent === null);
    return roots.map((root) => ({
      root,
      children: rows.filter((row) => row.parent === root.id),
    }));
  }, [data]);

  const openEdit = (row: Row) => {
    setAdding(null);
    setEditing(row);
    setDraft({ ...row });
  };

  const openAdd = (parent: number | null) => {
    setEditing(null);
    setAdding({ parent });
    setDraft({ name_ar: '', name_tr: '', name_en: '', icon: '', sort_order: 99, parent });
  };

  const close = () => {
    setEditing(null);
    setAdding(null);
  };

  const save = async () => {
    if (!draft.name_ar?.trim()) {
      toast('الاسم العربي مطلوب');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name_ar: draft.name_ar,
        name_tr: draft.name_tr ?? '',
        name_en: draft.name_en ?? '',
        icon: draft.icon ?? '',
        sort_order: Number(draft.sort_order ?? 99),
        is_active: draft.is_active ?? true,
        parent: adding ? adding.parent : (editing?.parent ?? null),
      };
      if (editing) {
        await api(`/admin/categories/${editing.id}`, { method: 'PATCH', body });
        toast('✅ حُفظ القسم');
      } else {
        await api('/admin/categories', { method: 'POST', body });
        toast('✅ أُضيف القسم');
      }
      close();
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: Row) => {
    try {
      await api(`/admin/categories/${row.id}`, {
        method: 'PATCH',
        body: { is_active: !row.is_active },
      });
      toast(row.is_active ? `أُخفي «${row.name_ar}»` : `ظهر «${row.name_ar}»`);
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`حذف «${row.name_ar}» نهائيًا؟`)) return;
    try {
      await api(`/admin/categories/${row.id}`, { method: 'DELETE' });
      toast('حُذف القسم');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  if (loading && !data) return <Spinner />;

  return (
    <div>
      <div className="row-between mb-16">
        <div>
          <h1 className="page-title">📂 الأقسام</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {data ? `${tree.length} قسمًا رئيسيًا · ${data.length - tree.length} فرعيًا` : '…'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd(null)}>
          ＋ قسم رئيسي
        </button>
      </div>

      <div className="mb-16">
        <Notice tone="info">
          تعديل الاسم يصل التطبيقات فورًا. والقسم الذي فيه إعلانات <b>لا يُحذف</b> —
          أخفِه فيختفي من التطبيق وتبقى إعلاناته سليمة.
        </Notice>
      </div>

      {!data || data.length === 0 ? (
        <Empty icon="📂" title="لا توجد أقسام" />
      ) : (
        tree.map(({ root, children }) => (
          <div className="card mb-16" key={root.id}>
            <CategoryLine
              row={root}
              onEdit={() => openEdit(root)}
              onToggle={() => toggleActive(root)}
              onDelete={() => remove(root)}
              isRoot
            />

            {children.length ? (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                {children.map((child) => (
                  <CategoryLine
                    key={child.id}
                    row={child}
                    onEdit={() => openEdit(child)}
                    onToggle={() => toggleActive(child)}
                    onDelete={() => remove(child)}
                  />
                ))}
              </div>
            ) : null}

            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => openAdd(root.id)}
            >
              ＋ قسم فرعي تحت «{root.name_ar}»
            </button>
          </div>
        ))
      )}

      {editing || adding ? (
        <div className="card" style={{ position: 'sticky', bottom: 16, boxShadow: 'var(--sh-lg)' }}>
          <div className="card-title">
            {editing
              ? `تعديل «${editing.name_ar}»`
              : adding?.parent
                ? 'قسم فرعي جديد'
                : 'قسم رئيسي جديد'}
          </div>

          <div className="row-3">
            {LANGS.map((lang) => (
              <div className="field" key={lang.key}>
                <label className="label">
                  الاسم ({lang.label})
                  {lang.key === 'name_ar' ? <span className="req"> *</span> : null}
                </label>
                <input
                  className="input"
                  value={String(draft[lang.key] ?? '')}
                  placeholder={lang.key === 'name_ar' ? '' : String(draft.name_ar ?? '')}
                  onChange={(e) => setDraft((d) => ({ ...d, [lang.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="row-3">
            <div className="field">
              <label className="label">الأيقونة</label>
              <input
                className="input"
                maxLength={4}
                placeholder="🚗"
                value={String(draft.icon ?? '')}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
              />
              <p className="hint">رمز تعبيري واحد. الأقسام الفرعية ترث أيقونة قسمها.</p>
            </div>
            <div className="field">
              <label className="label">الترتيب</label>
              <input
                className="input"
                type="number"
                value={Number(draft.sort_order ?? 99)}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
              />
              <p className="hint">الأصغر يظهر أولًا.</p>
            </div>
            <div className="field">
              <label className="label">الظهور</label>
              <label className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                  style={{ width: 17, height: 17, accentColor: 'var(--brand)' }}
                />
                <span className="muted txt-sm">يظهر في التطبيق</span>
              </label>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? 'جاري الحفظ…' : 'حفظ'}
            </button>
            <button className="btn btn-ghost" onClick={close}>
              إلغاء
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryLine({
  row,
  onEdit,
  onToggle,
  onDelete,
  isRoot,
}: {
  row: Row;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isRoot?: boolean;
}) {
  const locked = row.listings_count > 0 || row.children_count > 0;
  return (
    <div
      className="row-between"
      style={{
        gap: 10,
        padding: '8px 0',
        paddingInlineStart: isRoot ? 0 : 18,
        opacity: row.is_active ? 1 : 0.5,
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
        <span style={{ fontSize: isRoot ? 20 : 15 }}>{row.icon || (isRoot ? '📦' : '•')}</span>
        <div style={{ minWidth: 0 }}>
          <div className={isRoot ? 'bold' : ''}>
            {row.name_ar}
            {row.is_active ? null : <span className="muted txt-sm"> (مخفي)</span>}
          </div>
          <div className="muted txt-sm">
            {row.name_en || '—'} · {row.listings_count} إعلانًا
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          ✏️ تعديل
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onToggle}>
          {row.is_active ? '🚫 إخفاء' : '👁 إظهار'}
        </button>
        <button
          className="btn btn-danger btn-sm"
          disabled={locked}
          title={locked ? 'فيه إعلانات أو أقسام فرعية — أخفِه بدل حذفه' : ''}
          onClick={onDelete}
        >
          حذف
        </button>
      </div>
    </div>
  );
}
