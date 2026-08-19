import type { Doc, Lang } from './content';
import { UPDATED } from './content';

/**
 * شروط الاستخدام وقواعد المحتوى.
 *
 * ⚠️ قائمة «الممنوع» أدناه ليست تحصيل حاصل: سياسة المحتوى من المستخدمين لدى
 * Google Play تشترط أن يكون للتطبيق **قواعد منشورة** يستطيع المراجع قراءتها،
 * وأن تُذكر فيها السلع المقيّدة صراحةً. سوقٌ فيه قسم «حيوانات» وقسم «أدوات»
 * بلا قاعدة مكتوبة تمنع الأنواع المهدّدة والأسلحة يُقرأ على أنه تسهيل لبيعها.
 *
 * وهي أيضًا المرجع الذي يستند إليه فريق المراجعة عندنا حين يرفض إعلانًا —
 * فالرفض بلا قاعدة معلنة يبدو تعسّفًا.
 */

export const TERMS: Record<Lang, Doc> = {
  ar: {
    title: 'شروط الاستخدام وقواعد المحتوى',
    updated: UPDATED.ar,
    lead:
      'سوق الرقة وسيلة عرض فقط: نحن لا نبيع ولا نشتري ولا نضمن أي سلعة، ولا ندخل ' +
      'طرفًا في أي صفقة. الاتفاق والتسليم والدفع تجري بين البائع والمشتري وحدهما، ' +
      'خارج التطبيق ومسؤوليتهما.',
    sections: [
      {
        h: 'الحساب',
        p: [
          'تحتاج رقم هاتف حقيقي لإنشاء حساب. أنت مسؤول عن كل ما يُنشر منه، فاحفظ ' +
            'كلمة مرورك ولا تشاركها.',
          'يحقّ لنا إيقاف حساب يخالف هذه القواعد أو يُستعمل للاحتيال أو المضايقة.',
        ],
      },
      {
        h: 'إعلاناتك',
        p: [
          'اكتب وصفًا صادقًا وسعرًا حقيقيًا وصورًا للسلعة نفسها — لا صورًا منسوخة من ' +
            'الإنترنت لسلعة لا تملكها.',
          'الإعلان ينتهي تلقائيًا بعد ٦٠ يومًا، ويمكنك حذفه أو تعديله في أي وقت.',
          'معظم الإعلانات تمرّ بمراجعة بشرية قبل النشر. قد نرفض إعلانًا أو نوقفه إن ' +
            'خالف القواعد، ونذكر لك السبب.',
        ],
      },
      {
        h: 'الممنوع نشره — قائمة ملزمة',
        p: [
          'هذه القائمة ليست أمثلة بل قواعد. أي إعلان يقع تحت أحد بنودها يُرفض، ' +
            'وتكراره يوقف الحساب:',
        ],
        list: [
          'الأسلحة والذخائر والمتفجّرات وأي عتاد عسكري أو قطعه.',
          'المخدّرات والمواد المخدّرة والأدوية الموصوفة طبيًا ومكمّلات مجهولة المصدر.',
          'الكحول والتبغ ومنتجات النيكوتين والسجائر الإلكترونية.',
          'الحيوانات البرّية والأنواع المهدّدة بالانقراض وأجزاؤها (العاج، الجلود، الطيور الجارحة). بيع المواشي والدواجن المألوفة مسموح.',
          'أعضاء البشر والدم وأي شيء يمسّ جسد الإنسان بيعًا.',
          'الوثائق الرسمية: الهويّات وجوازات السفر والشهادات والرخص — أصلية أو مزوّرة.',
          'السلع المسروقة أو المقلَّدة، والبرمجيات والحسابات المقرصنة.',
          'المحتوى الجنسي أو الإباحي بأي شكل، وخدمات المرافقة.',
          'خدمات مالية مشبوهة: قروض ربوية مموّهة، عملات رقمية، «استثمار مضمون»، الربح السريع.',
          'بيانات شخصية لأشخاص آخرين: أرقام هواتف أو صور أو عناوين بلا إذنهم.',
          'ما يحضّ على الكراهية أو العنف أو التمييز الديني أو الطائفي أو العرقي.',
          'الإعلانات الوهمية والمكرّرة، ووضع سعر كاذب لجذب الضغطات.',
        ],
      },
      {
        h: 'سلامتك في الصفقة',
        p: [
          'التقِ البائع في مكان عام ونهارًا، وعايِن السلعة قبل الدفع.',
          'لا تحوّل مالًا مقدَّمًا لشخص لم تلتقِ به، ولا تشارك رمز تحقّق وصلك برسالة.',
          'أي سعر أقلّ بكثير من المعقول هو إشارة احتيال لا فرصة.',
        ],
      },
      {
        h: 'الإبلاغ والحظر',
        p: [
          'في كل إعلان زرّ «إبلاغ» يصل إلى فريق المراجعة، وزرّ «حظر المعلن» يخفي كل ' +
            'إعلانات ذلك الشخص عنك وحدك بلا أن يعلم.',
          'نراجع البلاغات ونتصرّف فيها، وقد نزيل الإعلان أو نوقف الحساب.',
        ],
      },
      {
        h: 'مجانية الخدمة',
        p: [
          'التطبيق مجاني بالكامل: لا رسوم نشر ولا اشتراكات ولا عمولة على أي صفقة، ' +
            'ولا توجد في التطبيق أي عملية دفع.',
        ],
      },
      {
        h: 'حدود مسؤوليتنا',
        p: [
          'لا نضمن صحّة ما يكتبه المعلنون ولا جودة السلع ولا إتمام أي صفقة. مسؤوليتنا ' +
            'تنحصر في تشغيل المنصّة ومراجعة المحتوى بجهد معقول.',
        ],
      },
      {
        h: 'تعديل الشروط',
        p: [
          'قد نعدّل هذه الشروط. التعديل الجوهري يُعلَن داخل التطبيق، ويُحدَّث تاريخ ' +
            'المراجعة أعلى الصفحة.',
        ],
      },
    ],
    contact: 'لأي استفسار أو اعتراض على قرار مراجعة، تواصل معنا:',
  },

  tr: {
    title: 'Kullanim Sartlari ve Icerik Kurallari',
    updated: UPDATED.tr,
    lead:
      'Rakka Carsisi yalnizca bir ilan platformudur: hicbir sey satmiyor, almiyor veya ' +
      'garanti etmiyoruz ve hicbir islemin tarafi degiliz. Anlasma, teslim ve odeme ' +
      'yalnizca alici ile satici arasinda, uygulama disinda gerceklesir.',
    sections: [
      {
        h: 'Hesap',
        p: [
          'Hesap acmak icin gercek bir telefon numarasi gerekir. Hesabinizdan yayinlanan ' +
            'her seyden siz sorumlusunuz; sifrenizi kimseyle paylasmayin.',
          'Bu kurallari ihlal eden veya dolandiricilik ya da tacizde kullanilan hesaplari durdururuz.',
        ],
      },
      {
        h: 'Ilanlariniz',
        p: [
          'Dogru aciklama, gercek fiyat ve urunun kendi fotograflarini kullanin — ' +
            'internetten kopyalanmis fotograflar degil.',
          'Ilan 60 gun sonra otomatik sona erer; istediginiz an silebilir veya duzenleyebilirsiniz.',
          'Ilanlarin cogu yayindan once insan incelemesinden gecer. Kurallara aykiri bir ilani ' +
            'reddedebilir veya durdurabiliriz; gerekcesini size bildiririz.',
        ],
      },
      {
        h: 'Yayinlanmasi yasak olanlar — baglayici liste',
        p: [
          'Bu liste ornek degil kuraldir. Maddelerden birine giren ilan reddedilir; ' +
            'tekrari hesabi durdurur:',
        ],
        list: [
          'Silah, muhimmat, patlayici ve her turlu askeri techizat veya parcasi.',
          'Uyusturucu maddeler, receteli ilaclar ve kaynagi belirsiz takviyeler.',
          'Alkol, tutun, nikotin urunleri ve elektronik sigara.',
          'Yabani hayvanlar, nesli tehlikedeki turler ve parcalari (fildisi, post, yirtici kuslar). Alisilmis ciftlik hayvani satisi serbesttir.',
          'Insan organlari, kan ve insan bedenine dair her turlu satis.',
          'Resmi belgeler: kimlik, pasaport, diploma ve ehliyet — gercek ya da sahte.',
          'Calinti veya taklit urunler, korsan yazilim ve hesaplar.',
          'Her turlu cinsel veya pornografik icerik ve eskort hizmetleri.',
          'Supheli finansal teklifler: gizli faizli krediler, kripto paralar, «garantili yatirim», hizli kazanc.',
          'Baskalarinin kisisel verileri: izinsiz telefon numarasi, fotograf veya adres.',
          'Nefret, siddet veya dini, mezhepsel, etnik ayrimcilik iceren her sey.',
          'Sahte ve tekrarlanan ilanlar, tiklama icin yazilan yanlis fiyatlar.',
        ],
      },
      {
        h: 'Islemde guvenliginiz',
        p: [
          'Saticiyla gunduz ve kalabalik bir yerde bulusun, odemeden once urunu gorun.',
          'Hic gormediginiz birine pesin para gondermeyin, SMS ile gelen dogrulama kodunu kimseyle paylasmayin.',
          'Makul olandan cok dusuk bir fiyat firsat degil, dolandiricilik isaretidir.',
        ],
      },
      {
        h: 'Sikayet ve engelleme',
        p: [
          'Her ilanda inceleme ekibine ulasan bir «Sikayet et» dugmesi ve o kisinin tum ' +
            'ilanlarini yalnizca sizden gizleyen bir «Engelle» dugmesi vardir.',
          'Sikayetleri inceler ve gerekirse ilani kaldirir veya hesabi durdururuz.',
        ],
      },
      {
        h: 'Hizmet ucretsizdir',
        p: [
          'Uygulama tamamen ucretsizdir: ilan ucreti, abonelik veya islem komisyonu yoktur ' +
            've uygulamada hicbir odeme islemi bulunmaz.',
        ],
      },
      {
        h: 'Sorumluluk sinirimiz',
        p: [
          'Ilan sahiplerinin yazdiklarinin dogrulugunu, urunlerin kalitesini veya bir ' +
            'islemin tamamlanmasini garanti etmeyiz. Sorumlulugumuz platformu isletmek ve ' +
            'icerigi makul ozenle incelemekle sinirlidir.',
        ],
      },
      {
        h: 'Sartlarin degismesi',
        p: [
          'Bu sartlari degistirebiliriz. Esasli degisiklik uygulama icinde duyurulur ve ' +
            'sayfanin ustundeki tarih guncellenir.',
        ],
      },
    ],
    contact: 'Her soru veya inceleme kararina itiraz icin bize ulasin:',
  },

  en: {
    title: 'Terms of Use and Content Rules',
    updated: UPDATED.en,
    lead:
      'Souq Raqqa is a listings platform only: we do not sell, buy or guarantee anything, ' +
      'and we are not a party to any transaction. Agreement, delivery and payment happen ' +
      'between buyer and seller alone, outside the app.',
    sections: [
      {
        h: 'Your account',
        p: [
          'You need a real phone number to create an account. You are responsible for ' +
            'everything published from it, so keep your password to yourself.',
          'We may suspend an account that breaks these rules or is used for fraud or harassment.',
        ],
      },
      {
        h: 'Your listings',
        p: [
          'Write an honest description, a real price, and use photos of the actual item — ' +
            'not images copied from the internet for something you do not own.',
          'A listing expires automatically after 60 days; you can edit or delete it at any time.',
          'Most listings pass human review before publication. We may reject or suspend a ' +
            'listing that breaks the rules, and we tell you why.',
        ],
      },
      {
        h: 'What may not be posted — binding list',
        p: [
          'This list is rules, not examples. A listing falling under any item is rejected, ' +
            'and repetition suspends the account:',
        ],
        list: [
          'Weapons, ammunition, explosives and any military equipment or parts.',
          'Drugs, narcotics, prescription medicines and supplements of unknown origin.',
          'Alcohol, tobacco, nicotine products and e-cigarettes.',
          'Wild animals, endangered species and their parts (ivory, hides, birds of prey). Ordinary livestock and poultry are allowed.',
          'Human organs, blood and anything sold that touches the human body.',
          'Official documents: IDs, passports, diplomas and licences — genuine or forged.',
          'Stolen or counterfeit goods, pirated software and accounts.',
          'Sexual or pornographic content of any kind, and escort services.',
          'Dubious financial offers: disguised interest loans, cryptocurrencies, "guaranteed investment", get-rich-quick schemes.',
          'Other people’s personal data: phone numbers, photos or addresses without their consent.',
          'Anything inciting hatred, violence, or religious, sectarian or ethnic discrimination.',
          'Fake or duplicate listings, and false prices posted to attract taps.',
        ],
      },
      {
        h: 'Staying safe in a deal',
        p: [
          'Meet the seller in a public place in daylight, and inspect the item before paying.',
          'Never send money in advance to someone you have not met, and never share a verification code sent to you by SMS.',
          'A price far below reason is a sign of fraud, not an opportunity.',
        ],
      },
      {
        h: 'Reporting and blocking',
        p: [
          'Every listing has a Report button that reaches our review team, and a Block ' +
            'button that hides all of that person’s listings from you alone, without telling them.',
          'We review reports and act on them, removing the listing or suspending the account where needed.',
        ],
      },
      {
        h: 'The service is free',
        p: [
          'The app is entirely free: no posting fees, no subscriptions, no commission on any ' +
            'deal, and no payment of any kind inside the app.',
        ],
      },
      {
        h: 'Limits of our responsibility',
        p: [
          'We do not guarantee the accuracy of what advertisers write, the quality of goods, ' +
            'or the completion of any deal. Our responsibility is limited to running the ' +
            'platform and reviewing content with reasonable effort.',
        ],
      },
      {
        h: 'Changes to these terms',
        p: [
          'We may amend these terms. A material change is announced inside the app and the ' +
            'review date at the top of this page is updated.',
        ],
      },
    ],
    contact: 'For any question, or to appeal a review decision, contact us:',
  },
};
