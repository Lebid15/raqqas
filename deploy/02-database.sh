#!/usr/bin/env bash
#
# سوق الرقة — قاعدة البيانات
#
# ينشئ قاعدة PostgreSQL ومستخدمها بكلمة مرور عشوائية، ويحفظها في
# /etc/souq/db.env بصلاحيات مقيّدة. إعادة التشغيل آمنة: لا تُبدَّل كلمة المرور
# إن كانت موجودة (وإلا انقطع التطبيق عن قاعدته).
#
set -euo pipefail

DB_NAME="souq"
DB_USER="souq"
SECRETS_DIR="/etc/souq"
DB_ENV="$SECRETS_DIR/db.env"

install -d -m 750 -o root -g souq "$SECRETS_DIR"

if [ -f "$DB_ENV" ]; then
  echo "▶ كلمة مرور قاعدة البيانات موجودة — نُبقيها"
  # shellcheck disable=SC1090
  . "$DB_ENV"
else
  echo "▶ توليد كلمة مرور قاعدة البيانات…"
  DB_PASSWORD="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"
  printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD" > "$DB_ENV"
  chmod 640 "$DB_ENV"
  chown root:souq "$DB_ENV"
fi

echo "▶ إنشاء المستخدم وقاعدة البيانات…"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

-- إعدادات تُسرّع Django وتمنع مفاجآت الترميز
ALTER ROLE $DB_USER SET client_encoding TO 'utf8';
ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';
ALTER ROLE $DB_USER SET timezone TO 'Asia/Damascus';
SQL

if ! sudo -u postgres psql -lqt | cut -d '|' -f1 | grep -qw "$DB_NAME"; then
  sudo -u postgres createdb -O "$DB_USER" -E UTF8 "$DB_NAME"
  echo "  ✓ أُنشئت قاعدة $DB_NAME"
else
  echo "  · قاعدة $DB_NAME موجودة"
fi

echo "▶ ضبط PostgreSQL لخادم بذاكرة 4 جيجا…"
PG_CONF="/etc/postgresql/$(ls /etc/postgresql | head -1)/main/conf.d/souq.conf"
install -d "$(dirname "$PG_CONF")"
cat > "$PG_CONF" <<'PGCONF'
# مضبوط لخادم CX23 (نواتان · 4 جيجا رام) — التطبيق يشارك الذاكرة نفسها
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 8MB
maintenance_work_mem = 128MB
max_connections = 60
random_page_cost = 1.1
effective_io_concurrency = 200
PGCONF

systemctl restart postgresql
systemctl enable postgresql >/dev/null

echo
echo "✅ قاعدة البيانات جاهزة"
sudo -u postgres psql -c "SELECT version();" | head -3
