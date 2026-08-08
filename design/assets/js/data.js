/* ==========================================================================
   سوق الرقة — بيانات تجريبية (Mock Data)
   هذه بيانات وهمية للتصميم فقط. في المشروع الحقيقي تأتي من Django REST API.
   ========================================================================== */

/* ---------- مولّد صور بديلة (بدون إنترنت) ---------- */
function ph(emoji, c1, c2, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="300" fill="url(#g)"/>` +
    `<text x="200" y="175" font-size="120" text-anchor="middle">${emoji}</text>` +
    (label ? `<text x="200" y="255" font-size="20" fill="rgba(255,255,255,.75)" text-anchor="middle" font-family="sans-serif">${label}</text>` : '') +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------- الأقسام ---------- */
const CATEGORIES = [
  { id: 'cars',      icon: '🚗', name: 'السيارات',                count: 412, subs: ['سيارات للبيع','دراجات نارية','قطع غيار','إطارات','شاحنات','تأجير سيارات'] },
  { id: 'realestate',icon: '🏠', name: 'العقارات',                count: 268, subs: ['بيوت للبيع','بيوت للإيجار','شقق','أراضٍ','محلات تجارية','مستودعات'] },
  { id: 'mobiles',   icon: '📱', name: 'الموبايلات والإلكترونيات', count: 731, subs: ['موبايلات','لابتوبات','تلفزيونات','إكسسوارات','ألعاب','كاميرات'] },
  { id: 'furniture', icon: '🪑', name: 'الأثاث والمنزل',          count: 356, subs: ['غرف نوم','كنبايات','أجهزة منزلية','مطابخ','ديكور','سجاد'] },
  { id: 'clothes',   icon: '👕', name: 'الملابس',                 count: 189, subs: ['رجالي','نسائي','أطفال','أحذية','حقائب','ساعات'] },
  { id: 'animals',   icon: '🐄', name: 'الحيوانات',               count: 143, subs: ['أغنام','أبقار','طيور','حيوانات أليفة','أعلاف'] },
  { id: 'tools',     icon: '🛠️', name: 'الأدوات والمعدات',        count: 97,  subs: ['معدات زراعية','عدد يدوية','مولدات','مضخات','معدات بناء'] },
  { id: 'jobs',      icon: '💼', name: 'الوظائف',                 count: 64,  subs: ['مطلوب موظف','أبحث عن عمل','عمل عن بعد','تدريب'] },
  { id: 'food',      icon: '🛒', name: 'المواد الغذائية',          count: 121, subs: ['خضار وفواكه','مواد تموينية','منتجات بيت','حلويات','لحوم'] },
  { id: 'services',  icon: '🔧', name: 'الخدمات',                 count: 156, subs: ['صيانة','نقل وشحن','تعليم وتدريس','حرف ومهن','تنظيف','تصميم'] },
  { id: 'other',     icon: '📦', name: 'أخرى',                    count: 58,  subs: ['متنوّع'] }
];

/* ---------- أحياء الرقة ---------- */
const NEIGHBORHOODS = [
  'المشلب', 'الرميلة', 'الدرعية', 'هشام بن عبد الملك', 'الفردوس',
  'الرومانية', 'المنصور', 'النهضة', 'الأندلس', 'تشرين',
  'السباهية', 'الوادي', 'الثكنة', 'الصناعة', 'الجزرة',
  'حي الفلاح', 'المرور', 'الأمين', 'القادسية', 'خارج المدينة'
];

/* ---------- الإعلانات ---------- */
const LISTINGS = [
  {
    id: 1, title: 'iPhone 15 Pro — 256 جيجا — بحالة ممتازة',
    price: 1000000, currency: 'SYP', cat: 'mobiles', catName: 'الموبايلات والإلكترونيات',
    sub: 'موبايلات', area: 'المشلب', condition: 'used', featured: true, photos: 8, video: true,
    time: 'منذ ساعتين', views: 342, seller: 'أحمد', sellerPhone: '0994 123 456',
    sellerJoined: 'عضو منذ 2024', sellerAds: 7, verified: true, status: 'published',
    img: ph('📱', '#1F2937', '#4B5563'),
    desc: 'آيفون 15 برو مساحة 256 جيجا، لون تيتانيوم طبيعي.\nالجهاز بحالة ممتازة جدًا، مستخدم 6 أشهر فقط.\nالبطارية 94%.\nمعه العلبة والشاحن الأصلي.\nلا يوجد أي خدش — كان بالجراب من أول يوم.\nالسعر قابل للتفاوض البسيط.\nالمعاينة في الرقة – حي المشلب.'
  },
  {
    id: 2, title: 'كيا ريو 2015 — فحص كامل — أوتوماتيك',
    price: 8500, currency: 'USD', cat: 'cars', catName: 'السيارات',
    sub: 'سيارات للبيع', area: 'الفردوس', condition: 'used', featured: true, photos: 10, video: false,
    time: 'منذ 4 ساعات', views: 890, seller: 'محمد', sellerPhone: '0991 887 220',
    sellerJoined: 'عضو منذ 2023', sellerAds: 12, verified: true, status: 'published',
    img: ph('🚗', '#0F766E', '#134E4A'),
    desc: 'كيا ريو موديل 2015، ماشية 140 ألف كم.\nأوتوماتيك — بنزين.\nفحص كامل، لا يوجد أي حوادث.\nالبويا وكالة ما عدا الرفرف الأمامي.\nالتأمين ساري.\nالسعر 8500 دولار قابل للتفاوض.'
  },
  {
    id: 3, title: 'بيت عربي للبيع — 200 متر — حي الرميلة',
    price: 45000, currency: 'USD', cat: 'realestate', catName: 'العقارات',
    sub: 'بيوت للبيع', area: 'الرميلة', condition: 'used', featured: true, photos: 10, video: true,
    time: 'منذ 6 ساعات', views: 1204, seller: 'أبو خالد', sellerPhone: '0993 550 118',
    sellerJoined: 'عضو منذ 2024', sellerAds: 3, verified: false, status: 'published',
    img: ph('🏠', '#B45309', '#78350F'),
    desc: 'بيت عربي مساحة 200 متر مربع.\nيتكوّن من 3 غرف + صالة + مطبخ + حمامين.\nالبيت طابق أرضي مع حوش واسع.\nالماء والكهرباء واصلة.\nالطابو أخضر جاهز للنقل.\nقريب من المدرسة والسوق.'
  },
  {
    id: 4, title: 'غسالة سامسونغ أوتوماتيك 7 كيلو',
    price: 450000, currency: 'SYP', cat: 'furniture', catName: 'الأثاث والمنزل',
    sub: 'أجهزة منزلية', area: 'الدرعية', condition: 'used', featured: false, photos: 4, video: false,
    time: 'منذ 8 ساعات', views: 156, seller: 'فاطمة', sellerPhone: '0995 331 907',
    sellerJoined: 'عضو منذ 2025', sellerAds: 2, verified: true, status: 'published',
    img: ph('🌀', '#0369A1', '#075985'),
    desc: 'غسالة سامسونغ أوتوماتيك سعة 7 كيلو.\nمستعملة سنتين، شغالة 100%.\nالسبب: شريت وحدة أكبر.\nالسعر 450 ألف قابل للنقاش.'
  },
  {
    id: 5, title: 'لابتوب Dell i7 الجيل العاشر — 16GB RAM',
    price: 620, currency: 'USD', cat: 'mobiles', catName: 'الموبايلات والإلكترونيات',
    sub: 'لابتوبات', area: 'المنصور', condition: 'used', featured: false, photos: 6, video: false,
    time: 'منذ 10 ساعات', views: 273, seller: 'يوسف', sellerPhone: '0992 604 335',
    sellerJoined: 'عضو منذ 2024', sellerAds: 9, verified: true, status: 'published',
    img: ph('💻', '#374151', '#111827'),
    desc: 'لابتوب Dell Latitude — معالج i7 الجيل العاشر.\nرام 16 جيجا — هارد SSD 512.\nالشاشة 15.6 إنش FHD.\nالبطارية تعطي 4 ساعات.\nمناسب للبرمجة والتصميم.'
  },
  {
    id: 6, title: 'غرفة نوم كاملة خشب زان — جديدة',
    price: 3200000, currency: 'SYP', cat: 'furniture', catName: 'الأثاث والمنزل',
    sub: 'غرف نوم', area: 'هشام بن عبد الملك', condition: 'new', featured: false, photos: 7, video: true,
    time: 'أمس', views: 421, seller: 'معرض النخبة', sellerPhone: '0996 220 441',
    sellerJoined: 'عضو منذ 2023', sellerAds: 34, verified: true, status: 'published',
    img: ph('🛏️', '#92400E', '#451A03'),
    desc: 'غرفة نوم كاملة خشب زان طبيعي.\nتشمل: تخت + خزانة 6 أبواب + تسريحة + كومودينين.\nصناعة محلية ممتازة.\nالتوصيل والتركيب مجانًا داخل الرقة.\nضمان سنتين على الخشب.'
  },
  {
    id: 7, title: 'مطلوب محاسب لشركة تجارية — دوام كامل',
    price: 0, currency: 'SYP', cat: 'jobs', catName: 'الوظائف',
    sub: 'مطلوب موظف', area: 'الصناعة', condition: 'new', featured: false, photos: 1, video: false,
    time: 'أمس', views: 682, seller: 'شركة الوفاء', sellerPhone: '0994 778 003',
    sellerJoined: 'عضو منذ 2025', sellerAds: 5, verified: true, status: 'published',
    img: ph('💼', '#1E40AF', '#1E3A8A'),
    desc: 'مطلوب محاسب للعمل في شركة تجارية بالرقة.\n\nالشروط:\n• خبرة لا تقل عن سنتين\n• إجادة برنامج الإكسل\n• من سكان الرقة\n\nالدوام: 8 ص – 4 م\nالراتب: يُحدَّد حسب الخبرة\nللتواصل عبر التطبيق أو الاتصال.'
  },
  {
    id: 8, title: '20 رأس غنم عواس — للبيع جملة',
    price: 4500, currency: 'USD', cat: 'animals', catName: 'الحيوانات',
    sub: 'أغنام', area: 'خارج المدينة', condition: 'new', featured: false, photos: 5, video: true,
    time: 'أمس', views: 318, seller: 'أبو عمر', sellerPhone: '0993 112 887',
    sellerJoined: 'عضو منذ 2024', sellerAds: 6, verified: false, status: 'published',
    img: ph('🐑', '#65A30D', '#3F6212'),
    desc: 'عدد 20 رأس غنم عواس.\nالأعمار بين سنة وسنتين.\nصحية وسليمة — مطعّمة.\nالبيع جملة فقط، لا يوجد بيع مفرّق.\nالمكان: قرية على طريق الرقة – حلب.'
  },
  {
    id: 9, title: 'مولدة كهرباء 5 كيلو ديزل — صينية',
    price: 950, currency: 'USD', cat: 'tools', catName: 'الأدوات والمعدات',
    sub: 'مولدات', area: 'الجزرة', condition: 'used', featured: false, photos: 3, video: false,
    time: 'منذ يومين', views: 205, seller: 'خالد', sellerPhone: '0991 445 662',
    sellerJoined: 'عضو منذ 2024', sellerAds: 4, verified: true, status: 'published',
    img: ph('⚡', '#CA8A04', '#713F12'),
    desc: 'مولدة كهرباء ديزل 5 كيلو واط.\nصناعة صينية، مستعملة سنة.\nشغالة ممتاز وصوتها منخفض.\nمعها الكابلات ولوحة التحكم.'
  },
  {
    id: 10, title: 'خدمة نقل أثاث داخل وخارج الرقة',
    price: 0, currency: 'SYP', cat: 'services', catName: 'الخدمات',
    sub: 'نقل وشحن', area: 'المرور', condition: 'new', featured: false, photos: 2, video: false,
    time: 'منذ يومين', views: 497, seller: 'مؤسسة الأمانة', sellerPhone: '0995 880 114',
    sellerJoined: 'عضو منذ 2023', sellerAds: 11, verified: true, status: 'published',
    img: ph('🚚', '#B91C1C', '#7F1D1D'),
    desc: 'خدمة نقل أثاث بسيارات مغلقة.\nعمّال مدرّبون على الفك والتركيب.\nتغليف مجاني للأثاث القابل للكسر.\nنعمل داخل الرقة وإلى بقية المحافظات.\nالأسعار حسب المسافة وكمية الأثاث.\nاتصل للاستفسار.'
  },
  {
    id: 11, title: 'تلفزيون LG سمارت 55 إنش 4K',
    price: 780000, currency: 'SYP', cat: 'mobiles', catName: 'الموبايلات والإلكترونيات',
    sub: 'تلفزيونات', area: 'النهضة', condition: 'used', featured: false, photos: 4, video: false,
    time: 'منذ 3 أيام', views: 388, seller: 'سامر', sellerPhone: '0992 331 776',
    sellerJoined: 'عضو منذ 2025', sellerAds: 3, verified: false, status: 'published',
    img: ph('📺', '#334155', '#0F172A'),
    desc: 'تلفزيون LG سمارت قياس 55 إنش دقة 4K.\nمستعمل سنة ونصف بحالة الجديد.\nالريموت الأصلي موجود.\nيدعم يوتيوب ونتفليكس.'
  },
  {
    id: 12, title: 'دراجة نارية هوندا 150 — موديل 2021',
    price: 1350, currency: 'USD', cat: 'cars', catName: 'السيارات',
    sub: 'دراجات نارية', area: 'الوادي', condition: 'used', featured: false, photos: 6, video: false,
    time: 'منذ 3 أيام', views: 512, seller: 'عمر', sellerPhone: '0994 009 231',
    sellerJoined: 'عضو منذ 2024', sellerAds: 8, verified: true, status: 'published',
    img: ph('🏍️', '#DC2626', '#7F1D1D'),
    desc: 'دراجة هوندا 150 سي سي موديل 2021.\nماشية 12 ألف كم فقط.\nالأوراق كاملة.\nإطارات جديدة.\nصيانة دورية عند الوكيل.'
  },
  {
    id: 13, title: 'محل تجاري للإيجار — شارع تل أبيض',
    price: 300, currency: 'USD', cat: 'realestate', catName: 'العقارات',
    sub: 'محلات تجارية', area: 'الأندلس', condition: 'used', featured: false, photos: 5, video: false,
    time: 'منذ 4 أيام', views: 733, seller: 'أبو ليث', sellerPhone: '0993 667 001',
    sellerJoined: 'عضو منذ 2023', sellerAds: 15, verified: true, status: 'published',
    img: ph('🏪', '#7C3AED', '#4C1D95'),
    desc: 'محل تجاري مساحة 40 متر.\nعلى شارع رئيسي — حركة ممتازة.\nواجهة زجاجية + مستودع صغير خلفي.\nالإيجار 300 دولار شهريًا.\nالدفع كل 6 أشهر.'
  },
  {
    id: 14, title: 'طقم كنب 7 مقاعد — قماش تركي',
    price: 1800000, currency: 'SYP', cat: 'furniture', catName: 'الأثاث والمنزل',
    sub: 'كنبايات', area: 'تشرين', condition: 'new', featured: false, photos: 6, video: false,
    time: 'منذ 5 أيام', views: 294, seller: 'معرض الشام', sellerPhone: '0996 118 552',
    sellerJoined: 'عضو منذ 2024', sellerAds: 22, verified: true, status: 'published',
    img: ph('🛋️', '#0891B2', '#164E63'),
    desc: 'طقم كنب 7 مقاعد (3 + 2 + 1 + 1).\nقماش تركي عالي الجودة.\nإسفنج ضغط عالي.\nألوان متعددة متوفرة.\nالتوصيل مجاني داخل الرقة.'
  },
  {
    id: 15, title: 'ملابس أطفال شتوية — جملة ومفرّق',
    price: 25000, currency: 'SYP', cat: 'clothes', catName: 'الملابس',
    sub: 'أطفال', area: 'المشلب', condition: 'new', featured: false, photos: 9, video: false,
    time: 'منذ 5 أيام', views: 176, seller: 'أم سارة', sellerPhone: '0991 220 887',
    sellerJoined: 'عضو منذ 2025', sellerAds: 18, verified: false, status: 'published',
    img: ph('🧥', '#DB2777', '#831843'),
    desc: 'ملابس أطفال شتوية مستوردة.\nأعمار من سنة إلى 10 سنوات.\nبيع جملة ومفرّق.\nالأسعار تبدأ من 25 ألف للقطعة.\nيوجد توصيل داخل الرقة.'
  },
  {
    id: 16, title: 'عسل طبيعي بلدي — إنتاج منزلي',
    price: 180000, currency: 'SYP', cat: 'food', catName: 'المواد الغذائية',
    sub: 'منتجات بيت', area: 'الرومانية', condition: 'new', featured: false, photos: 3, video: false,
    time: 'منذ أسبوع', views: 259, seller: 'أبو نايف', sellerPhone: '0995 447 336',
    sellerJoined: 'عضو منذ 2024', sellerAds: 5, verified: true, status: 'published',
    img: ph('🍯', '#D97706', '#78350F'),
    desc: 'عسل طبيعي بلدي 100%.\nإنتاج مناحلنا الخاصة.\nالكيلو 180 ألف ليرة.\nيوجد عينة للتذوق قبل الشراء.\nالتوصيل داخل الرقة.'
  }
];

/* ---------- إعلانات المستخدم (بحالات مختلفة) ---------- */
const MY_LISTINGS = [
  { ...LISTINGS[0], status: 'published' },
  { ...LISTINGS[4], status: 'pending',  statusNote: 'إعلانك قيد المراجعة — عادةً خلال ساعات قليلة.' },
  { ...LISTINGS[8], status: 'rejected', statusNote: 'الصور غير واضحة. يرجى إعادة رفع صور أوضح للمنتج.' },
  { ...LISTINGS[10], status: 'expired' }
];

/* ---------- المحادثات ---------- */
const CONVERSATIONS = [
  { id: 1, name: 'محمد', listingId: 1, listingTitle: 'iPhone 15 Pro — 256 جيجا',
    last: 'هل الجهاز موجود؟', time: '10:32', unread: 2, img: LISTINGS[0].img },
  { id: 2, name: 'سارة', listingId: 4, listingTitle: 'غسالة سامسونغ أوتوماتيك',
    last: 'تمام، بكرا بمر آخذها إن شاء الله', time: 'أمس', unread: 0, img: LISTINGS[3].img },
  { id: 3, name: 'أبو خالد', listingId: 3, listingTitle: 'بيت عربي للبيع — الرميلة',
    last: 'أنت: ممكن أشوف البيت يوم الجمعة؟', time: 'أمس', unread: 0, img: LISTINGS[2].img },
  { id: 4, name: 'عمر', listingId: 12, listingTitle: 'دراجة نارية هوندا 150',
    last: 'آخر سعر كم؟', time: 'الأحد', unread: 1, img: LISTINGS[11].img },
  { id: 5, name: 'يوسف', listingId: 5, listingTitle: 'لابتوب Dell i7',
    last: 'شكرًا لك، تم البيع', time: '03/08', unread: 0, img: LISTINGS[4].img }
];

const MESSAGES = [
  { day: 'اليوم' },
  { dir: 'in',  text: 'السلام عليكم، هل الجهاز موجود؟', time: '10:32' },
  { dir: 'out', text: 'وعليكم السلام، نعم موجود.', time: '10:35' },
  { dir: 'in',  text: 'ما هي نسبة البطارية؟', time: '10:36' },
  { dir: 'out', text: 'البطارية 94% — والجهاز نظيف جدًا، كان بجراب من أول يوم.', time: '10:38' },
  { dir: 'in',  text: 'والسعر قابل للتفاوض؟', time: '10:40' },
  { dir: 'out', text: 'تفاوض بسيط نعم. تفضل شوف الجهاز وبنتفق.', time: '10:41' },
  { dir: 'in',  text: 'تمام، وين ممكن أشوفه؟', time: '10:43' }
];

/* ---------- البلاغات (لوحة الإدارة) ---------- */
const REPORTS = [
  { id: 1, listing: 'iPhone 15 Pro — 256 جيجا', reporter: 'محمد ع.', reason: 'احتيال',
    note: 'طلب مني تحويل مبلغ مقدمًا قبل رؤية الجهاز', time: 'منذ ساعة', count: 3 },
  { id: 2, listing: 'ساعة رولكس أصلية — نصف السعر', reporter: 'سارة ح.', reason: 'إعلان مزيف',
    note: 'الساعة مقلّدة والصور مأخوذة من الإنترنت', time: 'منذ 3 ساعات', count: 6 },
  { id: 3, listing: 'أدوية بدون وصفة طبية', reporter: 'يوسف م.', reason: 'منتج ممنوع',
    note: 'بيع أدوية غير مرخّصة', time: 'أمس', count: 2 }
];

/* ---------- مستخدمو لوحة الإدارة ---------- */
const ADMIN_USERS = [
  { name: 'أحمد الحسن',  phone: '0994 123 456', ads: 7,  joined: '2024/03/12', status: 'active' },
  { name: 'محمد العلي',  phone: '0991 887 220', ads: 12, joined: '2023/11/05', status: 'active' },
  { name: 'فاطمة خالد',  phone: '0995 331 907', ads: 2,  joined: '2025/01/20', status: 'active' },
  { name: 'معرض النخبة', phone: '0996 220 441', ads: 34, joined: '2023/07/18', status: 'active' },
  { name: 'زياد س.',     phone: '0993 000 112', ads: 1,  joined: '2026/07/30', status: 'suspended' },
  { name: 'حساب مشبوه',  phone: '0990 555 777', ads: 0,  joined: '2026/08/01', status: 'banned' }
];

/* ---------- أسباب الإبلاغ ---------- */
const REPORT_REASONS = [
  { id: 'fraud',       label: 'احتيال',        icon: '⚠️' },
  { id: 'fake',        label: 'إعلان مزيف',    icon: '🎭' },
  { id: 'violation',   label: 'محتوى مخالف',   icon: '🚫' },
  { id: 'banned_item', label: 'منتج ممنوع',    icon: '⛔' },
  { id: 'other',       label: 'سبب آخر',       icon: '✍️' }
];
