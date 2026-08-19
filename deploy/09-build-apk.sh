#!/usr/bin/env bash
#
# سوق الرقة — بناء ملف APK موقّع
#
#   الاستعمال:  bash 09-build-apk.sh https://souq.syrz1.com
#
set -euo pipefail

BASE_URL="${1:?اكتب عنوان الموقع، مثل https://souq.syrz1.com}"
API_URL="$BASE_URL/api/v1"

APP_SRC="/srv/souq/app"
APK_DIR="/srv/souq/apk"
KEYSTORE_DIR="/etc/souq/keystore"
KEYSTORE="$KEYSTORE_DIR/souq-release.jks"
KEYSTORE_ENV="/etc/souq/keystore.env"

export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# ---------------------------------------------------------------- مفتاح التوقيع
#
# ⚠️⚠️ أخطر ملف في المشروع كلّه (plan2 §7.2).
#
# أندرويد يرفض تثبيت تحديث موقّع بمفتاح مختلف عن مفتاح النسخة المثبّتة. أي أن
# ضياع هذا المفتاح = **استحالة تحديث التطبيق لأي مستخدم إلى الأبد**، ولا حلّ
# إلا نشر تطبيق جديد وخسارة كل من ثبّت القديم.
#
install -d -m 700 "$KEYSTORE_DIR"

if [ ! -f "$KEYSTORE" ]; then
  echo "▶ توليد مفتاح التوقيع (مرة واحدة فقط في عمر المشروع)…"
  STORE_PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-24)"
  cat > "$KEYSTORE_ENV" <<ENV
KEYSTORE_PASSWORD=$STORE_PASS
KEY_ALIAS=souq
KEY_PASSWORD=$STORE_PASS
ENV
  chmod 600 "$KEYSTORE_ENV"

  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias souq \
    -keyalg RSA -keysize 4096 \
    -validity 10000 \
    -storepass "$STORE_PASS" \
    -keypass "$STORE_PASS" \
    -dname "CN=Souq Raqqa, OU=Mobile, O=Souq Raqqa, L=Raqqa, C=SY" >/dev/null
  chmod 600 "$KEYSTORE"
  echo "   ✓ أُنشئ — خذ نسخة احتياطية فورًا (التعليمات في نهاية المخرجات)"
else
  echo "▶ مفتاح التوقيع موجود — نستخدمه (لا يُبدَّل أبدًا)"
fi
. "$KEYSTORE_ENV"

# ---------------------------------------------------------------- الاعتماديات

cd "$APP_SRC"
echo "▶ تثبيت اعتماديات التطبيق…"
sudo -u souq -H npm install --no-audit --no-fund --silent

# ---------------------------------------------------------------- الهوية
#
# أيقونة الجوال واسمه تحتها يُثبّتان داخل ملف APK ولا يمكن تبديلهما على جهاز
# مثبَّت — لهذا لا يكفي مرورهما عبر app_config كبقية الإعدادات. يرفعهما الأدمن
# في اللوحة، ونحقنهما هنا قبل توليد المشروع الأصلي فيدخلان البناء التالي.

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
  # الأيقونة المربّعة والأمامية للأيقونة التكيّفية — نفس الصورة تكفي للاثنتين
  for target in assets/icon.png assets/android-icon-foreground.png assets/favicon.png; do
    python3 -c "
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

# معماريات الهواتف الحقيقية فقط.
# x86 و x86_64 لا يوجدان إلا في المحاكيات، وكانا يضيفان ~30 ميغابايت لكل
# مستخدم يحمّل التطبيق على إنترنت ضعيف — ثمن باهظ لمقابل معدوم.
reactNativeArchitectures=armeabi-v7a,arm64-v8a
PROPS

python3 - "$APP_SRC/android/app/build.gradle" <<'PY'
import re, sys, pathlib

path = pathlib.Path(sys.argv[1])
text = path.read_text()

# 1) إضافة إعدادات توقيع الإصدار بجانب إعدادات التطوير
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

    # 2) داخل buildTypes.release فقط — لا نلمس debug
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
# ⚠️ EXPO_PUBLIC_DISTRIBUTION=direct — لا يُحذف.
#
# هذا السكربت يبني نسخة **الموقع** لا نسخة المتجر. القيمة الافتراضية في
# app/src/config.ts هي `play` عمدًا (الخطأ في الاتجاه الآمن)، ولو تُركت هنا
# لخرج ملف APK يقول لمن نزّله من موقعنا «افتح المتجر» — والتطبيق ليس فيه بعد،
# فيصير التحديث مستحيلًا عليه.
#
# ونسخة المتجر تُبنى بسكربت آخر بقيمة `play`.

echo "▶ البناء (يستغرق 5–15 دقيقة)…"
cd "$APP_SRC/android"
chown -R souq:souq "$APP_SRC/android"
BUILD_VERSION="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['version'])")"
# EXPO_PUBLIC_APP_VERSION يُحقَن نصًّا داخل الحزمة، فيبقى الإصدار معروفًا حتى لو
# تعذّرت قراءته من إعدادات Expo لاحقًا (التفصيل في app/src/config.ts).
sudo -u souq -E env HOME=/home/souq \
  ANDROID_HOME="$ANDROID_HOME" \
  JAVA_HOME="$JAVA_HOME" \
  EXPO_PUBLIC_API_URL="$API_URL" \
  EXPO_PUBLIC_APP_VERSION="$BUILD_VERSION" \
  EXPO_PUBLIC_DISTRIBUTION=direct \
  ./gradlew assembleRelease --no-daemon -q

APK_SRC="$APP_SRC/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK_SRC" ] || { echo "❌ لم يُنتَج ملف APK"; exit 1; }

# ---------------------------------------------------------------- النشر

VERSION="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['version'])")"
install -d -o souq -g souq "$APK_DIR"
TARGET="$APK_DIR/souq-raqqa-$VERSION.apk"
cp "$APK_SRC" "$TARGET"
ln -sfn "$TARGET" "$APK_DIR/souq-raqqa-latest.apk"
chown -R souq:souq "$APK_DIR"

SHA="$(sha256sum "$TARGET" | cut -d' ' -f1)"
SIZE_MB="$(python3 -c "import os;print(round(os.path.getsize('$TARGET')/1048576, 1))")"

echo "▶ تسجيل النسخة في إعدادات التطبيق…"
cd /srv/souq/backend
sudo -u souq /srv/souq/venv/bin/python manage.py shell -c "
from apps.core.models import AppConfig
c = AppConfig.get_solo()
c.apk_url = '$BASE_URL/apk/souq-raqqa-$VERSION.apk'
c.apk_sha256 = '$SHA'
c.apk_size_mb = $SIZE_MB
c.latest_version = '$VERSION'
# min_version لا يُرفع هنا عمدًا. رفعه مع كل بناء يقفل التطبيق فورًا على كل من
# يحمل ما قبله، ويحوّل أي خلل في قراءة الإصدار إلى حجب تامّ بلا مخرج للمستخدم.
# الحجب الإجباري قرار يُتخذ من اللوحة عند ضرورة حقيقية فقط.
c.save()
print('   نسخة الإعدادات:', c.version)
" 2>/dev/null | tail -2

echo
echo "════════════════════════════════════════════════════"
echo "✅ ملف APK جاهز"
echo "════════════════════════════════════════════════════"
echo "الإصدار:  $VERSION"
echo "الحجم:    $SIZE_MB ميغابايت"
echo "الرابط:   $BASE_URL/apk/souq-raqqa-$VERSION.apk"
echo "البصمة:   $SHA"
echo
echo "⚠️  خذ نسخة احتياطية من مفتاح التوقيع الآن:"
echo "    scp -i ~/.ssh/souq_raqqa root@$(curl -4 -s ifconfig.me):$KEYSTORE ."
echo "    scp -i ~/.ssh/souq_raqqa root@$(curl -4 -s ifconfig.me):$KEYSTORE_ENV ."
