'use client';

import React from 'react';

import { api } from '@/lib/api';
import { Empty, Notice, Spinner, useAdmin, useApi } from '@/lib/admin';

type Update = {
  id: number;
  update_id: string;
  runtime_version: string;
  platform: string;
  is_active: boolean;
  notes: string;
  created_at: string;
};

/**
 * التحديثات عن بُعد.
 *
 * الغرض الحقيقي من هذه الشاشة هو **زر التراجع**، لا زر النشر. النشر يتم من
 * سطر الأوامر، أما لو خرج تحديث فيه خطأ فالتراجع يجب أن يكون بضغطة — وإلا
 * صار الحلّ الوحيد بناء APK ومطالبة الناس بتنزيله، وهو ما بُنيت هذه الميزة
 * أصلًا لتجنّبه.
 */
export default function UpdatesPage() {
  const { toast } = useAdmin();
  const { data, loading, reload } = useApi<Update[]>('/admin/updates');

  const activate = async (update: Update) => {
    if (!confirm(`تفعيل هذه الحزمة؟\n\n${update.notes || update.update_id}`)) return;
    try {
      await api(`/admin/updates/${update.id}/activate`, { method: 'POST', body: {} });
      toast('✅ فُعّلت — تصل المستخدمين عند فتح التطبيق التالي');
      void reload();
    } catch (caught) {
      toast((caught as Error).message);
    }
  };

  if (loading && !data) return <Spinner />;

  return (
    <div>
      <h1 className="page-title">🔄 التحديثات عن بُعد</h1>
      <p className="page-sub">
        تعديلات شاشات التطبيق ونصوصه تصل للناس بلا إعادة تنزيل
      </p>

      <div className="mb-16">
        <Notice tone="info">
          <b>ما الذي يصل من هنا؟</b> الشاشات والنصوص والمنطق.
          <br />
          <b>وما الذي يحتاج ملفًا جديدًا؟</b> مكتبة أصلية جديدة · إذن جهاز جديد ·
          أيقونة التطبيق أو اسمه. عندها تُرفع <span className="ltr">runtimeVersion</span>.
        </Notice>
      </div>

      {!data || data.length === 0 ? (
        <Empty
          icon="📦"
          title="لا توجد حزم منشورة"
          text="التطبيق يعمل بنسخته المدمجة داخل ملف APK."
        />
      ) : (
        <div className="stack">
          {data.map((update) => (
            <div
              key={update.id}
              className="card"
              style={update.is_active ? { borderColor: 'var(--success)' } : undefined}
            >
              <div className="row-between">
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    {update.is_active ? (
                      <span className="status status-published">● نشطة الآن</span>
                    ) : (
                      <span className="status status-draft">سابقة</span>
                    )}
                    <span className="muted txt-sm ltr">
                      runtime {update.runtime_version} · {update.platform}
                    </span>
                  </div>
                  <div className="bold mt-8">{update.notes || 'بلا ملاحظة'}</div>
                  <div className="muted txt-sm ltr" style={{ textAlign: 'start' }}>
                    {update.update_id}
                  </div>
                  <div className="muted txt-sm">
                    {new Date(update.created_at).toLocaleString('ar-EG')}
                  </div>
                </div>

                {!update.is_active ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => activate(update)}>
                    ↩︎ التراجع إليها
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
