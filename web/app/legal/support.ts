import { API_URL } from '@/lib/api';

/**
 * بيانات التواصل من لوحة الإدارة.
 *
 * لم نكتبها ثابتة في الصفحة لأن Google Play يشترط وسيلة تواصل عاملة في سياسة
 * الخصوصية — وبريدٌ مكتوب في الكود يتقادم بلا أن ينتبه أحد. هنا يغيّره الأدمن
 * من اللوحة فيتغيّر في الوثائق الثلاث معًا.
 */
export async function getSupport(): Promise<{ whatsapp: string; email: string }> {
  try {
    const response = await fetch(`${API_URL}/app-config`, { next: { revalidate: 3600 } });
    if (!response.ok) return { whatsapp: '', email: '' };
    const data = (await response.json()) as { support?: { whatsapp: string; email: string } };
    return data.support ?? { whatsapp: '', email: '' };
  } catch {
    // الخادم غير متاح — الوثيقة أهمّ من بيانات التواصل، فتُعرض بدونها
    return { whatsapp: '', email: '' };
  }
}
