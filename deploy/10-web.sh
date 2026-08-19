#!/usr/bin/env bash
#
# سوق الرقة — نشر الصفحة التعريفية ولوحة الإدارة (Next.js)
#
#   الاستعمال:  bash 10-web.sh https://souq.syrz1.com
#
# يُنفَّذ بعد رفع مجلد web/. إعادة تشغيله = أمر التحديث.
#
set -euo pipefail

BASE_URL="${1:?اكتب عنوان الموقع}"
WEB_SRC="/srv/souq/web-app"

export PATH="$PATH:/usr/bin"

echo "▶ تثبيت الاعتماديات وبناء الواجهة…"
cd "$WEB_SRC"
sudo -u souq -H npm install --no-audit --no-fund --silent
sudo -u souq -H env NEXT_PUBLIC_API_URL="$BASE_URL/api/v1" npx next build

echo "▶ خدمة Next.js…"
cat > /etc/systemd/system/souq-web.service <<SERVICE
[Unit]
Description=سوق الرقة — الصفحة التعريفية ولوحة الإدارة
After=network.target souq.service

[Service]
Type=simple
User=souq
Group=souq
WorkingDirectory=$WEB_SRC
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
Environment=NEXT_PUBLIC_API_URL=$BASE_URL/api/v1
ExecStart=/usr/bin/npx next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=false

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable souq-web >/dev/null
systemctl restart souq-web

echo "▶ ربطها بـ nginx…"
# الصفحة التعريفية ولوحة الإدارة على Next، والباقي كما هو.
# ترتيب المواقع في nginx يحسم: /api و /media و /static و /apk تُطابَق أولًا
# لأن مطابقة المسار الأدقّ تسبق مطابقة الجذر.
python3 - <<'PY'
import pathlib, re

path = pathlib.Path('/etc/nginx/sites-available/souq')
text = path.read_text()

upstream = """upstream souq_web {
    server 127.0.0.1:3000 fail_timeout=0;
}

"""
if 'souq_web' not in text:
    text = upstream + text

block = """
    location / {
        proxy_pass http://souq_web;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
    }
"""

# نستبدل موقع الجذر الثابت بتمريره إلى Next
text = re.sub(
    r"\n    location / \{\s*\n\s*try_files[^}]*\}\n",
    block,
    text,
    count=1,
)
path.write_text(text)
print("   ✓ nginx مهيّأ")
PY

nginx -t
systemctl reload nginx

sleep 3
echo
echo "✅ الواجهة تعمل"
systemctl is-active souq-web
curl -s -o /dev/null -w "   الصفحة التعريفية: %{http_code}\n" "$BASE_URL/"
curl -s -o /dev/null -w "   لوحة الإدارة:     %{http_code}\n" "$BASE_URL/admin/login"
