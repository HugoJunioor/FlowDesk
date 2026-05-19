#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# Provisiona um servidor Ubuntu 22.04 limpo para rodar o FlowDesk.
#
# - Instala Docker Engine + plugin compose
# - Cria usuario nao-root `flowdesk`
# - Configura firewall (UFW) liberando 22, 80, 443
# - Prepara diretorios em /opt/flowdesk
#
# Uso (como root):
#   bash provision-server.sh
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[erro] Rode como root (sudo)."
  exit 1
fi

echo "═══ FlowDesk provisioning ═══"
echo

# 1. Update sistema
echo "[1/6] Atualizando pacotes..."
apt-get update -qq
apt-get upgrade -y -qq

# 2. Instala dependencias basicas
echo "[2/6] Instalando dependencias..."
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban htop git unzip vim

# 3. Docker Engine + compose plugin (oficial)
echo "[3/6] Instalando Docker..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
else
  echo "  Docker ja instalado: $(docker --version)"
fi

# 4. Usuario flowdesk (nao-root)
echo "[4/6] Criando usuario 'flowdesk'..."
if ! id flowdesk &>/dev/null; then
  useradd -m -s /bin/bash flowdesk
  usermod -aG docker flowdesk
  echo "  Usuario criado."
else
  echo "  Usuario ja existe."
fi

# 5. Diretorios
echo "[5/6] Preparando diretorios..."
mkdir -p /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk
chown -R flowdesk:flowdesk /opt/flowdesk /var/log/flowdesk /var/backups/flowdesk

# 6. Firewall (UFW)
echo "[6/6] Configurando firewall..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status

echo
echo "═══ Provisioning concluido ═══"
echo
echo "Proximos passos:"
echo "  1. Faca login como 'flowdesk':  su - flowdesk"
echo "  2. Clone o repo:                 cd /opt/flowdesk && git clone <REPO_URL> app"
echo "  3. Configure .env (raiz + apps/api/)"
echo "  4. Rode:                         cd app && npm run preflight"
echo "  5. Sobe stack:                   docker compose -f docker-compose.prod.yml up -d"
