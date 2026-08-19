#!/usr/bin/env bash
#
# سوق الرقة — إبقاء الوصول برقم IP يعمل
#
# بعد تفعيل الشهادة، أضاف certbot كتلة تُعيد 404 لكل طلب لا يحمل اسم النطاق —
# فانكسر فتح الموقع برقم الـ IP.
#
# نعيده عمدًا لسببين:
#   1. صفحة اختبار الوصول من سوريا يجب أن تعمل بالطريقتين.
#   2. **تشخيص مهم:** لو فُتح الموقع بالـ IP ولم يُفتح بالنطاق، فالمشكلة في
#      حجب DNS لا في حجب الخادم — وهما مشكلتان مختلفتان تمامًا وحلّهما مختلف.
#
# ملف منفصل عمدًا: certbot يعدّل ملف النطاق عند كل تجديد ولا يلمس هذا.
#
set -euo pipefail

SERVER_IP="$(curl -4 -s --max-time 5 ifconfig.me)"

cat > /etc/nginx/sites-available/souq-ip <<NGINX
# الوصول برقم IP — للاختبار والتشخيص فقط، بلا تشفير.
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_IP;

    root /srv/souq/web;
    index index.html;

    client_max_body_size 15M;

    # لا نريد أن يفهرس محرّك بحث عنوانًا مؤقتًا بلا تشفير
    add_header X-Robots-Tag "noindex, nofollow" always;

    location /api/ {
        proxy_pass http://souq_app;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /media/ { alias /srv/souq/media/; expires 30d; access_log off; }
    location /static/ { alias /srv/souq/static/; expires 30d; access_log off; }

    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX

ln -sfn /etc/nginx/sites-available/souq-ip /etc/nginx/sites-enabled/souq-ip
nginx -t
systemctl reload nginx

echo "✅ الوصول برقم IP يعمل — http://$SERVER_IP"
