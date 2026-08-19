import type { Metadata } from 'next';

import { LegalPage } from '../legal/LegalPage';
import { getSupport } from '../legal/support';
import { DeleteForm } from './DeleteForm';
import { DELETION } from './deletion-doc';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'حذف الحساب — سوق الرقة',
  description: 'احذف حساب سوق الرقة وكل إعلاناتك وصورك نهائيًا، من التطبيق أو من هنا.',
};

/**
 * الرابط العام لحذف الحساب — يُكتب حرفيًا في Google Play Console
 * ضمن «أمان البيانات ‹ حذف الحساب».
 */
export default async function DeleteAccountPage() {
  return (
    <LegalPage docs={DELETION} support={await getSupport()}>
      <DeleteForm />
    </LegalPage>
  );
}
