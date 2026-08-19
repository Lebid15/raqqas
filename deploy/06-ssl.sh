#!/usr/bin/env bash
#
# سوق الرقة — شهادة التشفير (HTTPS)
#
#   الاستعمال:  bash 06-ssl.sh souq.syrz1.com بريدك@مثال.com
#
# شرط أساسي: النطاق يشير إلى هذا الخادم مباشرة، و**بلا وسيط Cloudflare**
# (سحابة رمادية). لو كان الوسيط مفعّلًا فقد يفشل التحقّق أو تصدر شهادة لا
# يستخدمها الزوّار أصلًا.
#
set -euo pipefail

DOMAIN="${1:?اكتب اسم النطاق}"
EMAIL="${2:?اكتب بريدًا لتنبيهات انتهاء الشهادة}"
APP_ENV="/etc/souq/app.env"

echo "▶ التحقّق من أن النطاق يشير إلينا…"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1)"
MYIP="$(curl -4 -s --max-time 5 ifconfig.me)"
echo "   $DOMAIN → $RESOLVED   (الخادم: $MYIP)"
if [ "$RESOLVED" != "$MYIP" ]; then
  echo "❌ النطاق لا يشير إلى هذا الخادم. تأكّد من سجلّ A ومن أن السحابة رمادية."
  exit 1
fi

echo "▶ تثبيت certbot…"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq certbot python3-certbot-nginx

echo "▶ ضبط اسم النطاق في nginx…"
sed -i "s/^\( *\)server_name .*/\1server_name $DOMAIN;/" /etc/nginx/sites-available/souq
nginx -t && systemctl reload nginx

echo "▶ طلب الشهادة…"
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect \
  --keep-until-expiring

echo "▶ تحديث إعدادات Django…"
# ALLOWED_HOSTS يبقى فيه رقم الـ IP أيضًا: صفحة اختبار الوصول من سوريا
# تُفتح برقم الـ IP، ولا نريد كسرها.
python3 - "$APP_ENV" "$DOMAIN" "$MYIP" <<'PY'
import sys, pathlib

path, domain, ip = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
values = {}
for line in path.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        key, _, value = line.partition("=")
        values[key] = value

values["ALLOWED_HOSTS"] = f"{domain},{ip},localhost,127.0.0.1"
values["PUBLIC_SITE_URL"] = f"https://{domain}"
values["CORS_ALLOWED_ORIGINS"] = f"https://{domain}"
values["CSRF_TRUSTED_ORIGINS"] = f"https://{domain}"
# التحويل إلى https يتولّاه nginx. لو فعّلناه في Django أيضًا لصار الوصول
# برقم الـ IP يُحوَّل إلى https على عنوان لا شهادة له — فتنكسر صفحة الاختبار.
values["SECURE_SSL_REDIRECT"] = "False"

path.write_text("\n".join(f"{k}={v}" for k, v in values.items()) + "\n")
print("   ", values["ALLOWED_HOSTS"])
PY

systemctl restart souq.service

echo "▶ التجديد التلقائي…"
systemctl enable --now certbot.timer >/dev/null 2>&1 || true
certbot renew --dry-run 2>&1 | tail -3

echo
echo "════════════════════════════════════════"
echo "✅ التشفير مفعّل — https://$DOMAIN"
echo "════════════════════════════════════════"
certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry Date|Domains"
