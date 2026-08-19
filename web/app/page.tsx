import type { Metadata } from 'next';

import { API_URL } from '@/lib/api';
import { Landing } from './landing';

/**
 * الصفحة التعريفية — صفحة واحدة فقط (plan2 §2).
 *
 * كل نصوصها من لوحة الإدارة، لا شيء مكتوب هنا. ونجلبها على الخادم لا في
 * المتصفّح لسببين: تظهر لمحرّكات البحث، وتصل جاهزة لمن إنترنته ضعيف.
 */

export const revalidate = 300;

type Landing = {
  headline: string;
  subline: string;
  body: string;
  cta: string;
  features: { icon: string; title: string; text: string }[];
};

export type LandingConfig = {
  landing: Record<string, Landing>;
  app: {
    latest_version: string;
    apk_url: string;
    apk_sha256: string;
    apk_size_mb: number;
  };
  support: { whatsapp: string; email: string };
};

async function getConfig(): Promise<LandingConfig | null> {
  try {
    const response = await fetch(`${API_URL}/app-config`, { next: { revalidate: 300 } });
    if (!response.ok) return null;
    return (await response.json()) as LandingConfig;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  const ar = config?.landing?.ar;
  return {
    title: ar?.headline || 'سوق الرقة — بيع واشترِ داخل مدينتك',
    description: ar?.subline || 'تطبيق سوق الرقة لبيع وشراء الأغراض داخل المدينة.',
    openGraph: {
      title: ar?.headline || 'سوق الرقة',
      description: ar?.subline || '',
      type: 'website',
    },
  };
}

export default async function HomePage() {
  const config = await getConfig();
  return <Landing config={config} />;
}
