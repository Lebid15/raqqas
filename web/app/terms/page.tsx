import type { Metadata } from 'next';

import { LegalPage } from '../legal/LegalPage';
import { TERMS } from '../legal/terms';
import { getSupport } from '../legal/support';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'شروط الاستخدام — سوق الرقة',
  description: 'قواعد النشر في سوق الرقة، وقائمة ما يُمنع عرضه.',
};

export default async function TermsPage() {
  return <LegalPage docs={TERMS} support={await getSupport()} />;
}
