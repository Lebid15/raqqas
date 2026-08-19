#!/usr/bin/env bash
#
# سوق الرقة — إصدار كامل بأمر واحد
#
#   bash deploy/14-release.sh --bump patch --track internal --notes "إصلاح لوحة المفاتيح"
#   bash deploy/14-release.sh --bump minor --track internal --notes "مبدّل العملة"
#   bash deploy/14-release.sh --track production --notes "..." --no-build --rollout 0.1
#
# يُنفَّذ **من جهازك** لا من الخادم — لأنه يعدّل app.json في مستودعك ثم يرفعه.
#
# ما يفعله بالترتيب:
#   ① يرفع version و versionCode في app/app.json
#   ② يرفع كود التطبيق إلى الخادم
#   ③ يبني حزمة .aab موقّعة هناك
#   ④ يرفعها إلى المسار المطلوب في Play
#
set -euo pipefail

SSH_KEY="${SOUQ_SSH_KEY:-$HOME/.ssh/souq_raqqa}"
SERVER="${SOUQ_SERVER:-root@46.224.188.126}"
BASE_URL="${SOUQ_BASE_URL:-https://souq.syrz1.com}"

BUMP=""
TRACK="internal"
NOTES=""
ROLLOUT=""
BUILD=1

while [ $# -gt 0 ]; do
  case "$1" in
    --bump)     BUMP="${2:?patch أو minor أو major}"; shift 2 ;;
    --track)    TRACK="${2:?}"; shift 2 ;;
    --notes)    NOTES="${2:?}"; shift 2 ;;
    --rollout)  ROLLOUT="${2:?}"; shift 2 ;;
    --no-build) BUILD=0; shift ;;
    -h|--help)  sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "خيار غير معروف: $1"; exit 1 ;;
  esac
done

if [ -z "$NOTES" ]; then
  echo "❌ اكتب --notes \"ما الذي تغيّر\""
  echo "   الملاحظات تظهر للمستخدمين في المتجر، وتُكتب مرة واحدة بثلاث لغات."
  exit 1
fi

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------- ① الإصدار
#
# Play يرفض versionCode سبق رفعه، ولو أُلغي إصداره. وهذا أكثر سبب فشل شائع
# في الرفع — فنرفعه هنا آليًا بدل الاعتماد على التذكّر.

if [ -n "$BUMP" ]; then
  echo "▶ رفع رقم الإصدار ($BUMP)…"
  python - "$BUMP" <<'PY'
import json, pathlib, sys

kind = sys.argv[1]
if kind not in {"patch", "minor", "major"}:
    raise SystemExit("❌ --bump يقبل: patch أو minor أو major")

path = pathlib.Path("app/app.json")
data = json.loads(path.read_text(encoding="utf-8"))
major, minor, patch = (int(part) for part in data["expo"]["version"].split("."))

if kind == "major":
    major, minor, patch = major + 1, 0, 0
elif kind == "minor":
    minor, patch = minor + 1, 0
else:
    patch += 1

data["expo"]["version"] = f"{major}.{minor}.{patch}"
data["expo"]["android"]["versionCode"] += 1

# write_bytes لا write_text: الثانية تحوّل \n إلى \r\n على ويندوز
path.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
print(f"   ✓ {data['expo']['version']} (versionCode {data['expo']['android']['versionCode']})")
PY
fi

VERSION="$(python -c "import json;print(json.load(open('app/app.json',encoding='utf-8'))['expo']['version'])")"

# ---------------------------------------------------------------- فحص قبل الرفع
#
# اختبارات الامتثال تحرس ما يرفضه Play: الصلاحيات الحسّاسة، وروابط الوثائق،
# ومسارَي حذف الحساب. فشلها هنا يكلّف دقيقتين، وفشلها في المراجعة يكلّف أسبوعين.

if [ "$BUILD" = "1" ]; then
  echo "▶ اختبارات الامتثال…"
  if [ -x backend/.venv/Scripts/python.exe ]; then
    (cd backend && ./.venv/Scripts/python.exe manage.py test tests.test_play_requirements -v 0)
  elif [ -x backend/.venv/bin/python ]; then
    (cd backend && ./.venv/bin/python manage.py test tests.test_play_requirements -v 0)
  else
    echo "   · لا بيئة بايثون محلّية — تخطّينا الاختبارات"
  fi

  echo "▶ فحص أنواع التطبيق…"
  (cd app && npx tsc --noEmit)
fi

# ---------------------------------------------------------------- ② و ③ البناء

if [ "$BUILD" = "1" ]; then
  echo "▶ رفع كود التطبيق إلى الخادم…"
  tar --exclude='node_modules' --exclude='.expo' --exclude='android' --exclude='.claude' \
      -czf - app | ssh -i "$SSH_KEY" "$SERVER" \
      "rm -rf /srv/souq/app && tar -xzf - -C /srv/souq && chown -R souq:souq /srv/souq/app"

  echo "▶ نسخ سكربتات النشر…"
  # نُمرّرها عبر tar لا scp: tar يحفظ الشجرة، و`sed` بعده يزيل أي \r
  # قد يكون تسرّب من ويندوز — السبب الذي كسر بناءً كاملًا من قبل.
  tar -czf - deploy/12-build-aab.sh deploy/13-play-upload.sh deploy/play \
    | ssh -i "$SSH_KEY" "$SERVER" \
      "tar -xzf - -C /tmp && \
       install -m 755 /tmp/deploy/12-build-aab.sh /root/12-build-aab.sh && \
       install -m 755 /tmp/deploy/13-play-upload.sh /root/13-play-upload.sh && \
       rm -rf /root/play && cp -r /tmp/deploy/play /root/play && \
       sed -i 's/\r\$//' /root/12-build-aab.sh /root/13-play-upload.sh /root/play/*.py && \
       rm -rf /tmp/deploy"

  echo "▶ بناء حزمة المتجر (5–15 دقيقة)…"
  ssh -i "$SSH_KEY" "$SERVER" "bash /root/12-build-aab.sh $BASE_URL"
fi

# ---------------------------------------------------------------- ④ الرفع

echo "▶ الرفع إلى Google Play — المسار «$TRACK»…"
ROLLOUT_ARG=""
[ -n "$ROLLOUT" ] && ROLLOUT_ARG="--rollout $ROLLOUT"

# shellcheck disable=SC2029  # التوسيع مقصود: القيم تُحسب هنا لا هناك
ssh -i "$SSH_KEY" "$SERVER" \
  "bash /root/13-play-upload.sh --track '$TRACK' --notes '$NOTES' $ROLLOUT_ARG"

echo
echo "════════════════════════════════════════════════════"
echo "✅ اكتمل إصدار $VERSION"
echo "════════════════════════════════════════════════════"
echo
echo "لا تنسَ تثبيت رقم الإصدار في Git:"
echo "  git add app/app.json && git commit -m \"إصدار $VERSION — $NOTES\" && git push"
