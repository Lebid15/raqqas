#!/usr/bin/env bash
#
# سوق الرقة — نشر تحديث عن بُعد (بلا ملف APK جديد)
#
#   الاستعمال:  bash 11-publish-update.sh "ملاحظة عن التحديث"
#
# متى يكفي هذا؟ عند تعديل شاشات التطبيق أو نصوصه أو منطقه.
# متى لا يكفي؟ عند تغيير مكتبة أصلية أو إذن جهاز أو أيقونة — عندها APK جديد
#              مع رفع runtimeVersion في app.json.
#
set -euo pipefail

NOTES="${1:-تحديث}"
APP_SRC="/srv/souq/app"
RUNTIME="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['runtimeVersion'])")"

export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

echo "▶ تصدير حزمة JavaScript للطبقة الأصلية $RUNTIME…"
cd "$APP_SRC"
sudo -u souq -H rm -rf dist
APP_VERSION="$(python3 -c "import json;print(json.load(open('$APP_SRC/app.json'))['expo']['version'])")"
# الإصدار يُحقَن في الحزمة نصًّا — فلا يبقى معرفة التطبيق بإصداره رهينة البيان
sudo -u souq -E env HOME=/home/souq \
  EXPO_PUBLIC_API_URL="https://souq.syrz1.com/api/v1" \
  EXPO_PUBLIC_APP_VERSION="$APP_VERSION" \
  npx expo export --platform android --output-dir dist

echo "▶ النشر والتفعيل…"
cd /srv/souq/backend
sudo -u souq /srv/souq/venv/bin/python manage.py publish_update \
  --source "$APP_SRC/dist" \
  --runtime "$RUNTIME" \
  --platform android \
  --app-json "$APP_SRC/app.json" \
  --notes "$NOTES"

chown -R souq:souq /srv/souq/updates 2>/dev/null || true

echo
echo "✅ التحديث منشور — يصل المستخدمين عند فتح التطبيق التالي."
echo "   للتراجع: لوحة الإدارة ← التحديثات ← فعّل الحزمة السابقة."
