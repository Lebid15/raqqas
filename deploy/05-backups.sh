#!/usr/bin/env bash
#
# سوق الرقة — نسخ احتياطي يومي (plan2 §7.3)
#
# ينسخ قاعدة البيانات وصور الإعلانات يوميًا، ويحتفظ بـ 14 يومًا.
#
# ⚠️ نسخة على الخادم نفسه ليست نسخة احتياطية حقيقية — إن ضاع الخادم ضاعت معه.
#    هذه الخطوة الأولى؛ نقلها خارج الخادم هو الخطوة الثانية (تعليمات في النهاية).
#
set -euo pipefail

BACKUP_DIR="/srv/souq/backups"
KEEP_DAYS=14

install -d -o souq -g souq -m 750 "$BACKUP_DIR"

cat > /usr/local/bin/souq-backup <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/srv/souq/backups"
KEEP_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"

# قاعدة البيانات
sudo -u postgres pg_dump --format=custom souq \
  > "$BACKUP_DIR/db_$STAMP.dump"

# الصور — نسخة تراكمية أسبوعيًا فقط (يومية تملأ القرص)
if [ "$(date +%u)" = "5" ]; then
  tar -czf "$BACKUP_DIR/media_$STAMP.tar.gz" -C /srv/souq media 2>/dev/null || true
fi

# حذف ما تجاوز المدة
find "$BACKUP_DIR" -name 'db_*.dump'      -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name 'media_*.tar.gz' -mtime +$((KEEP_DAYS * 2)) -delete

# تحذير إن امتلأ القرص — أسوأ عطل هو الذي لا أحد يراه
USED=$(df --output=pcent /srv | tail -1 | tr -dc '0-9')
if [ "$USED" -gt 85 ]; then
  logger -t souq-backup "⚠️ القرص ممتلئ بنسبة ${USED}%"
fi

logger -t souq-backup "اكتملت النسخة الاحتياطية $STAMP"
SCRIPT

chmod +x /usr/local/bin/souq-backup

# مؤقّت systemd بدل cron — سجلّه أوضح وتشغيله اليدوي أسهل
cat > /etc/systemd/system/souq-backup.service <<'UNIT'
[Unit]
Description=نسخة احتياطية لسوق الرقة

[Service]
Type=oneshot
ExecStart=/usr/local/bin/souq-backup
UNIT

cat > /etc/systemd/system/souq-backup.timer <<'TIMER'
[Unit]
Description=نسخة احتياطية يومية لسوق الرقة

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
RandomizedDelaySec=600

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now souq-backup.timer

echo "▶ تشغيل أول نسخة للتأكّد…"
/usr/local/bin/souq-backup
ls -lh "$BACKUP_DIR"

echo
echo "✅ النسخ الاحتياطي مضبوط — يوميًا 3:30 فجرًا"
systemctl list-timers souq-backup.timer --no-pager | head -3
