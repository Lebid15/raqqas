# دليل النشر عبر الموقع (APK) — سوق الرقة

> **متى تستعمل هذا الملف؟** بعد كل تعديل، لتجرّبه على جوالك الحقيقي قبل أن
> يصل إلى المتجر. هذه قناة **التجربة**.
>
> للنشر في Google Play اقرأ `deploy/PLAY.md` — قناة **الإطلاق**.
>
> **آخر تحديث:** 2026-08-19

---

## 0. لماذا قناتان لا واحدة؟

| | الموقع (هذا الملف) | المتجر (`PLAY.md`) |
|---|---|---|
| الغرض | **تجربة** التعديل قبل نشره | **إطلاق** للناس |
| المدة | 10–15 دقيقة | مراجعة غوغل: ساعات إلى أيام |
| الملف | `.apk` | `.aab` |
| التراجع | ابنِ من جديد فورًا | تحتاج إصدارًا جديدًا ومراجعة |

**الفائدة الحقيقية:** خطأ تكتشفه في نسخة الموقع تُصلحه في ربع ساعة. الخطأ
نفسه لو وصل المتجر يبقى أمام المستخدمين حتى تجتاز مراجعة أخرى.

**لذلك القاعدة:** لا شيء يذهب إلى المتجر قبل أن يُجرَّب هنا.

---

## 1. الأمر — بعد أي تعديل

ثلاث خطوات بالترتيب. الأولى من مجلد المشروع على جهازك:

### ① ارفع رقم الإصدار

```bash
python -c "
import json, pathlib
p = pathlib.Path('app/app.json')
d = json.loads(p.read_text(encoding='utf-8'))
major, minor, patch = d['expo']['version'].split('.')
d['expo']['version'] = f'{major}.{minor}.{int(patch)+1}'
d['expo']['android']['versionCode'] += 1
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('الإصدار الجديد:', d['expo']['version'], '| versionCode:', d['expo']['android']['versionCode'])
"
```

> ⚠️ **لا تتخطَّ هذه الخطوة.** ملف APK يُسمّى برقم الإصدار. لو بنيت برقم قديم
> استُبدل الملف القديم بالجديد بالاسم نفسه، ولن تظهر لافتة التحديث لأحد —
> لأن الخادم يقارن الأرقام لا الملفات.

### ② ارفع الكود إلى الخادم

```bash
tar --exclude='node_modules' --exclude='.expo' --exclude='android' --exclude='.claude' \
    -czf - app | ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 \
    "rm -rf /srv/souq/app && tar -xzf - -C /srv/souq && chown -R souq:souq /srv/souq/app"
```

### ③ ابنِ ووقّع وانشر

```bash
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 \
    "nohup bash /root/09-build-apk.sh https://souq.syrz1.com > /root/build.log 2>&1 &"

# المتابعة (البناء 5–15 دقيقة)
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 "tail -f /root/build.log"
```

عند انتهائه يفعل السكربت هذا كلّه تلقائيًا:
- ينسخ الملف إلى `/srv/souq/apk/souq-raqqa-<الإصدار>.apk`
- يحدّث `latest_version` و`apk_sha256` و`apk_size_mb` في الإعدادات
- فتظهر لافتة «يتوفّر تحديث» لكل من يحمل نسخة أقدم

ثم افتح `https://souq.syrz1.com` من جوالك واضغط «حمّل التطبيق».

---

## 2. إن غيّرت الخلفية أيضًا

كثير من التعديلات تمسّ الخلفية والتطبيق معًا. **انشر الخلفية أولًا** — تطبيق
جديد يكلّم خادمًا قديمًا يفشل بأخطاء غامضة، والعكس آمن:

```bash
tar --exclude='.venv' --exclude='__pycache__' --exclude='db.sqlite3' \
    --exclude='media' --exclude='staticfiles' --exclude='.env' \
    -czf - backend | ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 \
    "tar -xzf - -C /srv/souq && bash /root/03-deploy.sh"
```

`03-deploy.sh` يرحّل قاعدة البيانات ويعيد تشغيل الخدمة.

**قبل أي ترحيل يغيّر جدولًا، خذ نسخة احتياطية:**

```bash
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 "/usr/local/bin/souq-backup"
```

## 3. إن غيّرت الويب (اللوحة أو الصفحة التعريفية)

```bash
tar --exclude='node_modules' --exclude='.next' --exclude='tsconfig.tsbuildinfo' \
    -czf - web | ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 \
    "rm -rf /tmp/web-new && mkdir -p /tmp/web-new && tar -xzf - -C /tmp/web-new && \
     rsync -a --delete --exclude='node_modules' --exclude='.next' /tmp/web-new/web/ /srv/souq/web-app/ && \
     chown -R souq:souq /srv/souq/web-app && rm -rf /tmp/web-new"

ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 \
    "cd /srv/souq/web-app && sudo -u souq -H npm install --no-audit --no-fund --silent && \
     sudo -u souq -H env NEXT_PUBLIC_API_URL=https://souq.syrz1.com/api/v1 npx next build && \
     systemctl restart souq-web"
```

---

## 4. تحديث بلا بناء أصلًا — الأسرع

**تعديل في كود JavaScript فقط** (شاشة، نصّ، منطق، تصميم) لا يحتاج ملف APK
جديدًا. يصل عبر التحديث عن بُعد (OTA) خلال دقائق، ويطبّقه المستخدم بإعادة فتح
التطبيق:

```bash
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 "bash /root/11-publish-update.sh"
```

**ما لا يصل بهذه الطريقة** — يلزمه بناء APK كامل:
- تغيير في `app.json` (الاسم · الأيقونة · الصلاحيات · `versionCode`)
- إضافة مكتبة فيها كود أصلي (native)
- تغيير عنوان الخادم `EXPO_PUBLIC_API_URL`
- الأيقونة والاسم تحتها: **يثبّتهما أندرويد عند التثبيت ولا يبدّلهما شيء بعده**

---

## 5. أعطال معروفة — وقعنا فيها فعلًا

### 5.1 `set: pipefail: invalid option name`

**السبب:** السكربت وصل بنهايات أسطر ويندوز (CRLF).

**الخطورة:** لا يتوقف بل **يتابع بلا حماية `set -e`**، ومساراته تحمل محرف `\r`
لاصقًا بآخرها — فيبني في مجلد اسمه `app\r` ويفشل بعد عشر دقائق بسبب لا علاقة
له بالمشكلة.

**الوقاية:** ملف `.gitattributes` في جذر المشروع يُلزم `*.sh` بنهايات لينكس.
وإن حرّرت سكربتًا ببايثون فاكتبه بايتات لا نصًّا:

```python
p.write_bytes(text.encode("utf-8"))   # ✅
p.write_text(text)                     # ❌ يحوّل \n إلى \r\n على ويندوز
```

**العلاج الفوري على الخادم:**
```bash
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 "sed -i 's/\r$//' /root/09-build-apk.sh"
```

### 5.2 `ModuleNotFoundError: No module named 'PIL'`

`Pillow` مثبّت في البيئة الافتراضية `/srv/souq/venv` لا في بايثون النظام.
السكربت يستعمل `/srv/souq/venv/bin/python` لخطوة الأيقونة — لا تُعِده إلى
`python3`.

### 5.3 لافتة التحديث لا تظهر

راجع أنك رفعت `version` (الخطوة ①). الخادم يقارن `latest_version` بإصدار
التطبيق، ورقمان متساويان يعنيان «لا جديد».

### 5.4 «افتح المتجر» في نسخة الموقع

`EXPO_PUBLIC_DISTRIBUTION=direct` مفقود من أمر البناء. القيمة الافتراضية في
`app/src/config.ts` هي `play` عمدًا، والسكربت يحقن `direct`. إن ظهر الزرّ خطأً
فراجع أن السكربت على الخادم هو النسخة المحدَّثة:

```bash
ssh -i ~/.ssh/souq_raqqa root@46.224.188.126 "grep -c DISTRIBUTION /root/09-build-apk.sh"   # يجب أن يعيد 2
```

### 5.5 أندرويد يرفض التثبيت فوق نسخة قديمة

توقيع مختلف. تأكّد أن `/etc/souq/keystore/souq-release.jks` لم يُبدَّل. لو ضاع
المفتاح فلا حلّ إلا حذف التطبيق وإعادة تثبيته — ولهذا **خذ نسخة احتياطية منه**
(التفاصيل في `PLAY.md` §3.1).

---

## 6. قائمة فحص قبل كل بناء

```bash
# 1) اختبارات الخلفية
cd backend && .venv/Scripts/python.exe manage.py test tests

# 2) أنواع التطبيق
cd app && npx tsc --noEmit

# 3) بناء الويب
cd web && npx next build

# 4) لا سكربت بنهايات ويندوز
python -c "
import pathlib
bad = [f.name for f in pathlib.Path('deploy').glob('*.sh') if b'\r\n' in f.read_bytes()]
print('✗ CRLF في:', bad) if bad else print('✓ كل السكربتات سليمة')
"
```

---

## 7. ماذا نجرّب على الجوال؟

بعد التثبيت، مرّ على هذه — كلها تعديلات حديثة تحتاج عينًا بشرية:

- [ ] **لوحة المفاتيح**: افتح تسجيل الدخول واضغط حقل كلمة المرور — يجب أن يبقى مرئيًا فوق اللوحة. جرّب أيضًا: إضافة إعلان · تعديل الملف الشخصي · نطاق السعر في المرشّحات.
- [ ] **مبدّل العملة**: أيقونة العملة في الترويسة → بدّل بين الأربع. الأسعار تتغيّر فورًا بلا تحميل.
- [ ] **سعر البائع ثابت**: السطر الأول لا يتغيّر مهما بدّلت عملتك — يتغيّر سطر `≈` وحده.
- [ ] **إضافة إعلان**: اختر عملة غير الافتراضية وتأكّد أن الإعلان يظهر بها.
- [ ] **حظر معلن**: افتح إعلانًا لغيرك → 🚫 → يجب أن تختفي كل إعلاناته. ثم «حسابي ‹ المحظورون» → رفع الحظر.
- [ ] **حذف الحساب**: «حسابي ‹ حذف حسابي» — **بحساب تجريبي لا بحسابك**.
- [ ] **الوثائق**: «حسابي» → سياسة الخصوصية · شروط الاستخدام — يجب أن تفتحا في المتصفّح.
- [ ] **الهوية**: الاسم والشعار في الترويسة يطابقان ما في لوحة الإدارة.

---

## 8. متى ننتقل إلى المتجر؟

حين تمرّ القائمة أعلاه بلا ملاحظة. عندها اقرأ `deploy/PLAY.md` وابنِ نسخة
`.aab` — وهي **نفس الكود** بقيمة `DISTRIBUTION=play` وحدها مختلفة.
