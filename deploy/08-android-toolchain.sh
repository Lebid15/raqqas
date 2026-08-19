#!/usr/bin/env bash
#
# سوق الرقة — أدوات بناء أندرويد على الخادم
#
# لماذا على الخادم لا على جهازك؟
#   · لا يحتاج حسابًا في خدمة خارجية ولا انتظار طوابير
#   · البناء يخرج مباشرة إلى مجلد التنزيل — بلا نقل يدوي
#   · قابل للتكرار: أي شخص يشغّل السكربت فيحصل على النتيجة نفسها
#
set -euo pipefail

SDK_ROOT="/opt/android-sdk"
CMDLINE_VERSION="13114758"   # cmdline-tools 17.0

export DEBIAN_FRONTEND=noninteractive

echo "▶ Java 17…"
apt-get install -y -qq openjdk-17-jdk-headless unzip

echo "▶ Node.js 22…"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "   node $(node -v) · npm $(npm -v)"

echo "▶ Android SDK…"
if [ ! -d "$SDK_ROOT/cmdline-tools/latest" ]; then
  install -d "$SDK_ROOT/cmdline-tools"
  cd /tmp
  curl -fsSL -o cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VERSION}_latest.zip"
  unzip -q -o cmdline-tools.zip -d "$SDK_ROOT/cmdline-tools"
  mv "$SDK_ROOT/cmdline-tools/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -f cmdline-tools.zip
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH"

echo "▶ قبول التراخيص…"
yes 2>/dev/null | sdkmanager --licenses >/dev/null 2>&1 || true

echo "▶ تثبيت مكوّنات البناء (قد يستغرق دقائق)…"
sdkmanager --install \
  "platform-tools" \
  "platforms;android-36" \
  "platforms;android-35" \
  "build-tools;36.0.0" \
  "build-tools;35.0.0" \
  "ndk;27.1.12297006" 2>&1 | tail -3

# متغيّرات البيئة لكل المستخدمين — gradle يبحث عنها
cat > /etc/profile.d/android.sh <<PROFILE
export ANDROID_HOME=$SDK_ROOT
export ANDROID_SDK_ROOT=$SDK_ROOT
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=\$PATH:$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools
PROFILE
chmod +x /etc/profile.d/android.sh

chown -R souq:souq "$SDK_ROOT"

echo
echo "✅ أدوات البناء جاهزة"
java -version 2>&1 | head -1
echo "SDK: $SDK_ROOT"
du -sh "$SDK_ROOT"
