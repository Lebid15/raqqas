#!/usr/bin/env bash
#
# سوق الرقة — التجهيز الأساسي للخادم (يُنفَّذ مرة واحدة، وإعادته آمنة)
#
#   نظام محدَّث · مستخدم غير root · تقوية SSH · جدار ناري · حماية من التخمين
#
set -euo pipefail

APP_USER="souq"
TIMEZONE="Asia/Damascus"

echo "▶ تحديث النظام…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "▶ ضبط المنطقة الزمنية والاسم…"
timedatectl set-timezone "$TIMEZONE"
hostnamectl set-hostname souq-raqqa
grep -q souq-raqqa /etc/hosts || echo "127.0.1.1 souq-raqqa" >> /etc/hosts

echo "▶ الحزم الأساسية…"
apt-get install -y -qq \
  ufw fail2ban unattended-upgrades \
  git curl ca-certificates gnupg rsync \
  build-essential pkg-config \
  python3 python3-venv python3-dev python3-pip \
  postgresql postgresql-contrib libpq-dev \
  nginx \
  libjpeg-dev zlib1g-dev libwebp-dev \
  fonts-noto-core

echo "▶ إنشاء مستخدم التشغيل: $APP_USER"
# لا نشغّل التطبيق بصلاحيات root — لو اختُرق التطبيق لا يملك الخادم كلّه
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG sudo "$APP_USER"

# نفس مفتاح الدخول ينفع للمستخدمَين
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
cp /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"
chmod 600 "/home/$APP_USER/.ssh/authorized_keys"

# sudo بلا كلمة مرور — الحساب بلا كلمة مرور أصلًا والدخول بالمفتاح فقط
echo "$APP_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$APP_USER"
chmod 440 "/etc/sudoers.d/90-$APP_USER"

echo "▶ تقوية SSH…"
# الدخول بالمفتاح حصرًا. كلمات المرور تُخمَّن، والمفاتيح لا تُخمَّن.
cat > /etc/ssh/sshd_config.d/99-souq.conf <<'SSHCONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 120
ClientAliveCountMax 3
X11Forwarding no
SSHCONF
sshd -t
systemctl restart ssh

echo "▶ الجدار الناري…"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable

echo "▶ الحماية من محاولات التخمين…"
cat > /etc/fail2ban/jail.local <<'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
F2B
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "▶ تحديثات الأمان التلقائية…"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTO

echo "▶ ملف تبديل (Swap) بحجم 2 جيجا…"
# 3.7 جيجا رام تكفي، لكن بناء الحزم وضغط الصور قد يقفزان فجأة.
# بلا swap يقتل النظام العملية ويتوقّف الموقع بلا سبب ظاهر.
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

echo
echo "════════════════════════════════════════"
echo "✅ التجهيز الأساسي اكتمل"
echo "════════════════════════════════════════"
echo "المستخدم:      $APP_USER"
echo "SSH:           بالمفتاح فقط (كلمات المرور معطّلة)"
echo "الجدار الناري: 22 / 80 / 443 فقط"
ufw status | tail -n +2
