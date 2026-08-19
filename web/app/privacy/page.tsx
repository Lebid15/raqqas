import type { Metadata } from 'next';

import { LegalPage } from '../legal/LegalPage';
import { PRIVACY } from '../legal/content';
import { getSupport } from '../legal/support';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — سوق الرقة',
  description: 'ما الذي يجمعه تطبيق سوق الرقة، وما الذي لا يجمعه، وكيف تحذف حسابك.',
};

export default async function PrivacyPage() {
  return <LegalPage docs={PRIVACY} support={await getSupport()} />;
}
