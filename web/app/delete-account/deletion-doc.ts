import type { Doc, Lang } from '../legal/content';
import { UPDATED } from '../legal/content';

/**
 * نصّ صفحة حذف الحساب.
 *
 * Google Play لا يكتفي بوجود زرّ: يطلب صفحة تشرح **ما الذي يُحذف وما الذي قد
 * يبقى ولماذا**. لذلك القسمان الأولان هنا جدولان صريحان لا عبارات عامّة.
 */
export const DELETION: Record<Lang, Doc> = {
  ar: {
    title: 'حذف حساب سوق الرقة',
    updated: UPDATED.ar,
    lead:
      'يمكنك حذف حسابك في أي وقت، من داخل التطبيق أو من هذه الصفحة. الحذف فوري ' +
      'ونهائي — لا نحتفظ بنسخة ولا يمكن استرجاع الحساب بعده.',
    sections: [
      {
        h: 'ما الذي يُحذف',
        p: ['كل ما يخصّك، من قاعدة البيانات ومن القرص معًا:'],
        list: [
          'حسابك: الاسم ورقم الهاتف ورقم واتساب وكلمة المرور.',
          'كل إعلاناتك — المنشورة والمنتهية وقيد المراجعة.',
          'كل صور إعلاناتك، تُمحى ملفاتها من الخادم لا سجلّاتها فقط.',
          'مفضّلتك، وأجهزتك المسجّلة للإشعارات، وبلاغاتك، وقائمة من حظرتهم.',
        ],
      },
      {
        h: 'ما الذي قد يبقى — ولماذا',
        p: [
          'سطر واحد مجهول الهوية: بصمة مشفّرة لرقم هاتفك (لا يمكن ردّها إلى الرقم) ' +
            'مع تاريخ الحذف. غرضها الوحيد منع إساءة الاستعمال — أن يُحذف حساب بعد ' +
            'سلسلة بلاغات ثم يعود بالرقم نفسه في اللحظة التالية.',
          'قد تبقى نسخ احتياطية دورية للخادم مدة قصيرة قبل أن تُستبدل تلقائيًا. ' +
            'لا تُقرأ ولا تُستعمل إلا لاسترجاع الخدمة بعد عطل.',
        ],
      },
      {
        h: 'من التطبيق مباشرة',
        p: ['إن كان التطبيق مثبَّتًا لديك فهذا أسرع:'],
        list: [
          'افتح تبويب «حسابي».',
          'اختر «حذف حسابي» في أسفل القائمة.',
          'اكتب كلمة مرورك وأكّد.',
        ],
      },
    ],
    contact: 'إن واجهت مشكلة في الحذف، تواصل معنا وسننفّذه يدويًا:',
  },

  tr: {
    title: 'Rakka Carsisi hesabini silme',
    updated: UPDATED.tr,
    lead:
      'Hesabinizi istediginiz an, uygulamadan veya bu sayfadan silebilirsiniz. Silme ' +
      'aninda ve kalicidir — hicbir kopya saklamayiz ve hesap geri getirilemez.',
    sections: [
      {
        h: 'Silinenler',
        p: ['Size ait her sey, hem veritabanindan hem diskten:'],
        list: [
          'Hesabiniz: ad, telefon numarasi, WhatsApp numarasi ve sifre.',
          'Tum ilanlariniz — yayinda, suresi dolmus ve incelemedekiler.',
          'Tum ilan fotograflariniz; yalnizca kayitlari degil dosyalari da sunucudan silinir.',
          'Favorileriniz, bildirim icin kayitli cihazlariniz, sikayetleriniz ve engel listeniz.',
        ],
      },
      {
        h: 'Kalabilecekler — ve nedeni',
        p: [
          'Kimlik tasimayan tek bir satir: telefon numaranizin sifrelenmis izi (numaraya ' +
            'geri cevrilemez) ve silme tarihi. Tek amaci kotuye kullanimi onlemek — bir ' +
            'hesabin sikayetler sonrasi silinip hemen ayni numarayla geri donmesini engellemek.',
          'Sunucunun periyodik yedekleri kisa sure, otomatik olarak degistirilene kadar ' +
            'kalabilir. Yalnizca bir arizadan sonra hizmeti kurtarmak icin kullanilir.',
        ],
      },
      {
        h: 'Dogrudan uygulamadan',
        p: ['Uygulama kuruluysa en hizlisi budur:'],
        list: [
          '«Hesabim» sekmesini acin.',
          'Listenin altindaki «Hesabimi sil» secenegine dokunun.',
          'Sifrenizi yazip onaylayin.',
        ],
      },
    ],
    contact: 'Silme sirasinda sorun yasarsaniz bize yazin, elle tamamlayalim:',
  },

  en: {
    title: 'Delete your Souq Raqqa account',
    updated: UPDATED.en,
    lead:
      'You can delete your account at any time, from inside the app or from this page. ' +
      'Deletion is immediate and permanent — we keep no copy and the account cannot be restored.',
    sections: [
      {
        h: 'What is deleted',
        p: ['Everything that belongs to you, from the database and from disk:'],
        list: [
          'Your account: name, phone number, WhatsApp number and password.',
          'All your listings — published, expired and awaiting review.',
          'All your listing photos; the files themselves are erased from the server, not just their records.',
          'Your favourites, devices registered for notifications, reports and block list.',
        ],
      },
      {
        h: 'What may remain — and why',
        p: [
          'A single anonymous row: a hashed fingerprint of your phone number (which cannot ' +
            'be turned back into the number) together with the deletion date. Its only ' +
            'purpose is to prevent abuse — an account deleted after a string of reports ' +
            'returning under the same number moments later.',
          'Periodic server backups may persist briefly until they are automatically rotated. ' +
            'They are read only to restore service after a failure.',
        ],
      },
      {
        h: 'Directly in the app',
        p: ['If the app is installed, this is the fastest route:'],
        list: [
          'Open the Account tab.',
          'Choose "Delete my account" at the bottom of the list.',
          'Type your password and confirm.',
        ],
      },
    ],
    contact: 'If you hit a problem deleting, contact us and we will do it manually:',
  },
};
