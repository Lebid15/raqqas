#!/usr/bin/env bash
#
# سوق الرقة — بناء حزمة Android App Bundle (.aab) لمتجر Google Play
#
#   الاستعمال:  bash 12-build-aab.sh https://souq.syrz1.com
#
# ═══ الفرق عن 09-build-apk.sh ═══
#
#   ① `bundleRelease` لا `assembleRelease` — Play يرفض ملفات APK للتطبيقات
#      الجديدة منذ آب 2021، ولا يقبل إلا حزمة .aab.
#
#   ② `EXPO_PUBLIC_DISTRIBUTION=play` — فلا تحتوي الحزمة كود تنزيل APK
#      إطلاقًا. تنزيل حزمة تثبيت من خارج المتجر داخل تطبيق منشور فيه مخالفة
#      لسياسة «إساءة استخدام الجهاز والشبكة»، وعقوبتها إزالة التطبيق.
#
#   ③ لا يلمس `apk_url` ولا `latest_version` في الإعدادات. تلك الحقول تقود
#      لافتة التحديث لمستخدمي نسخة الموقع، ورفعها هنا كان سيطالبهم بتحديث
#      لا وجود له عندهم.
#
#   ④ لا يشترط معماريات محدّدة: Play يولّد من الحزمة ملفًا مفصّلًا لكل جهاز
#      (Split APKs)، فالمستخدم لا ينزّل إلا معمارية جهازه أصلًا.
#
set -euo pipefail

BASE_URL="${1:?اكتب عنوان الموقع، مثل https://souq.syrz1.com}"
API_URL="$BASE_URL/api/v1"

APP_SRC="/srv/souq/app"
AAB_DIR="/srv/souq/aab"
KEYSTORE_DIR="/etc/souq/keystore"
KEYSTORE="$KEYSTORE_DIR/souq-release.jks"
KEYSTORE_ENV="/etc/souq/keystore.env"

export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# ---------------------------------------------------------------- مفتاح التوقيع
#
# ⚠️ نفس المفتاح الذي توقَّع به نسخة الموقع — وهذا مقصود.
#
# القرار المتّخذ (deploy/PLAY.md §3.1): نرفع هذا المفتاح إلى Google ليكون
# مفتاح توقيع التطبيق، لا أن يولّد غوغل مفتاحًا جديدًا. فمن ثبّت APK من موقعنا
# يستطيع التحديث من المتجر بلا حذف وإعادة تثبيت.
#
# ولو وُلِّد هنا مفتاح جديد لانقطع ذلك الجسر إلى الأبد — لذلك نتوقّف بدل أن
# نولّد. توليد المفتاح مسؤولية 09-build-apk.sh وحده، ومرة واحدة في عمر المشروع.

if [ ! -f "$KEYSTORE" ]; then
  echo "❌ مفتاح التوقيع غير موجود: $KEYSTORE"
  echo "   شغّل 09-build-apk.sh أولًا — هو الذي يولّده مرة واحدة."
  echo "   لا نولّده هنا عمدًا: مفتاحان مختلفان = مستخدمون لا يستطيعون التحديث."
  exit 1
fi
echo "▶ مفتاح التوقيع موجود — نستخدمه (لا يُبدَّل أبدًا)"
. "$KEYSTORE_ENV"

# ---------------------------------------------------------------- الاعتماديات

cd "$APP_SRC"
echo "▶ تثبيت اعتماديات التطبيق…"
sudo -u souq -H npm install --no-audit --no-fund --silent

VERSION="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['version'])")"
VERSION_CODE="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['android']['versionCode'])")"
echo "   الإصدار: $VERSION (versionCode $VERSION_CODE)"

# ---------------------------------------------------------------- الهوية
#
# أيقونة الجوال واسمه تحتها يُثبّتان داخل الحزمة ولا يمكن تبديلهما على جهاز
# مثبَّت — لهذا لا يكفي مرورهما عبر app_config كبقية الإعدادات.

echo "▶ هوية التطبيق من لوحة الإدارة…"
IDENTITY="$(cd /srv/souq/backend && sudo -u souq /srv/souq/venv/bin/python manage.py shell -c "
from apps.core.models import AppConfig
c = AppConfig.get_solo()
print(c.app_name_ar)
print(c.launcher_icon.path if c.launcher_icon else '')
" 2>/dev/null | tail -2)"

APP_NAME="$(echo "$IDENTITY" | head -1)"
ICON_PATH="$(echo "$IDENTITY" | tail -1)"

if [ -n "$APP_NAME" ]; then
  python3 - "$APP_SRC/app.json" "$APP_NAME" <<'PY'
import json, sys, pathlib
path, name = pathlib.Path(sys.argv[1]), sys.argv[2]
data = json.loads(path.read_text(encoding="utf-8"))
data["expo"]["name"] = name
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"   ✓ الاسم تحت الأيقونة: {name}")
PY
fi

if [ -n "$ICON_PATH" ] && [ -f "$ICON_PATH" ]; then
  for target in assets/icon.png assets/android-icon-foreground.png assets/favicon.png; do
    /srv/souq/venv/bin/python -c "
from PIL import Image
import sys
image = Image.open(sys.argv[1]).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
image.save(sys.argv[2], format='PNG')
" "$ICON_PATH" "$APP_SRC/$target"
  done
  chown -R souq:souq "$APP_SRC/assets"
  echo "   ✓ أيقونة الجوال من اللوحة"
else
  echo "   · لا أيقونة مرفوعة — نستعمل المدمجة"
fi

echo "▶ توليد مشروع أندرويد الأصلي…"
sudo -u souq -E env HOME=/home/souq \
  EXPO_PUBLIC_API_URL="$API_URL" \
  ANDROID_HOME="$ANDROID_HOME" \
  npx expo prebuild --platform android --clean --no-install

# ---------------------------------------------------------------- إعداد التوقيع

echo "▶ ربط مفتاح التوقيع ببناء الإصدار…"
cp "$KEYSTORE" "$APP_SRC/android/app/souq-release.jks"
chown souq:souq "$APP_SRC/android/app/souq-release.jks"
chmod 600 "$APP_SRC/android/app/souq-release.jks"

cat >> "$APP_SRC/android/gradle.properties" <<PROPS

# ---- توقيع الإصدار (يُولَّد آليًا — لا يُرفع إلى Git) ----
SOUQ_STORE_FILE=souq-release.jks
SOUQ_STORE_PASSWORD=$KEYSTORE_PASSWORD
SOUQ_KEY_ALIAS=$KEY_ALIAS
SOUQ_KEY_PASSWORD=$KEY_PASSWORD

# خادم بذاكرة 4 جيجا — بلا هذا يُقتَل البناء في منتصفه
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
org.gradle.daemon=false
org.gradle.parallel=false

# لا نحصر المعماريات هنا — بخلاف بناء APK.
# Play يفصّل من الحزمة ملفًا لكل جهاز، فلا ينزّل المستخدم إلا معماريته.
# حصرها كان سيمنع التطبيق من العمل على أجهزة صالحة بلا أي توفير.
PROPS

python3 - "$APP_SRC/android/app/build.gradle" <<'PY'
import re, sys, pathlib

path = pathlib.Path(sys.argv[1])
text = path.read_text()

if "signingConfigs.release" not in text:
    release_config = """
        release {
            storeFile file(SOUQ_STORE_FILE)
            storePassword SOUQ_STORE_PASSWORD
            keyAlias SOUQ_KEY_ALIAS
            keyPassword SOUQ_KEY_PASSWORD
        }
"""
    text = text.replace("signingConfigs {", "signingConfigs {" + release_config, 1)

    match = re.search(r"buildTypes\s*\{", text)
    if not match:
        raise SystemExit("لم أجد buildTypes في build.gradle")
    tail = text[match.end():]
    release_match = re.search(r"release\s*\{", tail)
    if not release_match:
        raise SystemExit("لم أجد buildTypes.release")
    start = match.end() + release_match.end()
    replaced = re.sub(
        r"signingConfig\s+signingConfigs\.debug",
        "signingConfig signingConfigs.release",
        text[start:],
        count=1,
    )
    text = text[:start] + replaced

path.write_text(text)
print("   ✓ build.gradle مهيّأ")
PY

# ---------------------------------------------------------------- البناء
#
# ⚠️ EXPO_PUBLIC_DISTRIBUTION=play — لا يُحذف.
#
# هذه حزمة المتجر. القيمة تُحقن وقت البناء لا تُقرأ من الخادم، لأن المراجع
# يقرأ الكود لا الإعدادات: حزمة المتجر يجب ألّا تحوي مسار تنزيل APK أصلًا.

echo "▶ بناء الحزمة (يستغرق 5–15 دقيقة)…"
cd "$APP_SRC/android"
chown -R souq:souq "$APP_SRC/android"
sudo -u souq -E env HOME=/home/souq \
  ANDROID_HOME="$ANDROID_HOME" \
  JAVA_HOME="$JAVA_HOME" \
  EXPO_PUBLIC_API_URL="$API_URL" \
  EXPO_PUBLIC_APP_VERSION="$VERSION" \
  EXPO_PUBLIC_DISTRIBUTION=play \
  ./gradlew bundleRelease --no-daemon -q

AAB_SRC="$APP_SRC/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$AAB_SRC" ] || { echo "❌ لم تُنتَج حزمة .aab"; exit 1; }

# ---------------------------------------------------------------- الحفظ

install -d -o souq -g souq "$AAB_DIR"
TARGET="$AAB_DIR/souq-raqqa-$VERSION.aab"
cp "$AAB_SRC" "$TARGET"
ln -sfn "$TARGET" "$AAB_DIR/souq-raqqa-latest.aab"
chown -R souq:souq "$AAB_DIR"

SIZE_MB="$(python3 -c "import os;print(round(os.path.getsize('$TARGET')/1048576, 1))")"

# ---------------------------------------------------------------- فحص أخير
#
# نفحص الصلاحيات داخل الحزمة نفسها لا في app.json: بين الاثنين يقع دمج
# ملفات AndroidManifest لكل مكتبة، وقد تُدخل مكتبةٌ صلاحيةً لم يطلبها أحد.
# اكتشاف ذلك هنا أرخص بكثير من اكتشافه في بريد رفض بعد أسبوعين.

echo "▶ فحص صلاحيات الحزمة…"
BUNDLETOOL_MANIFEST="$(cd "$APP_SRC/android" && unzip -p "$TARGET" base/manifest/AndroidManifest.xml 2>/dev/null | strings | grep -o 'android.permission.[A-Z_]*' | sort -u || true)"
if [ -n "$BUNDLETOOL_MANIFEST" ]; then
  echo "$BUNDLETOOL_MANIFEST" | sed 's/^/   · /'
  for BAD in CAMERA RECORD_AUDIO READ_MEDIA_IMAGES SYSTEM_ALERT_WINDOW ACCESS_FINE_LOCATION; do
    if echo "$BUNDLETOOL_MANIFEST" | grep -q "android.permission.$BAD\$"; then
      echo "   ⚠️  تحذير: الصلاحية $BAD موجودة في الحزمة — راجع blockedPermissions في app.json"
    fi
  done
else
  echo "   · تعذّرت قراءة البيان — افحص الصلاحيات يدويًا في الكونسول بعد الرفع"
fi

echo
echo "════════════════════════════════════════════════════"
echo "✅ حزمة المتجر جاهزة"
echo "════════════════════════════════════════════════════"
echo "الإصدار:      $VERSION"
echo "versionCode:  $VERSION_CODE"
echo "الحجم:        $SIZE_MB ميغابايت"
echo "المسار:       $TARGET"
echo
echo "الخطوة التالية:"
echo "  bash /root/13-play-upload.sh --track internal --notes \"وصف التحديث\""
