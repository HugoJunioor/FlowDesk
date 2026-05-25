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

# 6. Firewall (UFW) — ACESSO RESTRITO A VPNs
echo "[6/6] Configurando firewall (VPN-only)..."

# IPs das VPNs autorizadas. Defina via env var VPN_IPS (separado por virgula)
# antes de rodar o script. Ex:
#   export VPN_IPS="1.2.3.4,5.6.7.8"
#   bash scripts/provision-server.sh
if [ -z "${VPN_IPS:-}" ]; then
  echo "ERRO: defina VPN_IPS=\"ip1,ip2,...\" antes de rodar." >&2
  exit 1
fi
IFS=',' read -ra VPN_IPS <<< "$VPN_IPS"

ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing

# SSH (22), HTTP (80) e HTTPS (443) APENAS pelas VPNs.
# HTTP fica liberado tambem nas VPNs pro Let's Encrypt HTTP-challenge
# funcionar (Traefik redireciona pra HTTPS automaticamente).
for ip in "${VPN_IPS[@]}"; do
  ufw allow from "$ip" to any port 22 proto tcp comment "SSH from VPN $ip"
  ufw allow from "$ip" to any port 80 proto tcp comment "HTTP from VPN $ip"
  ufw allow from "$ip" to any port 443 proto tcp comment "HTTPS from VPN $ip"
done

# Let's Encrypt valida o dominio pela INTERNET (HTTP-01 challenge).
# Pra emitir/renovar o cert, a porta 80 precisa estar acessivel publicamente.
# Solucao: libera 80 publico mas o Traefik so responde challenge ACME
# (qualquer outra rota 80 redireciona pra 443 — que so VPN acessa).
ufw allow 80/tcp comment 'HTTP publico (Let\'s Encrypt challenge + redirect)'

ufw --force enable
ufw status verbose

echo
echo "═══ Provisioning concluido ═══"
echo
echo "Proximos passos:"
echo "  1. Faca login como 'flowdesk':  su - flowdesk"
echo "  2. Clone o repo:                 cd /opt/flowdesk && git clone <REPO_URL> app"
echo "  3. Configure .env (raiz + apps/api/)"
echo "  4. Rode:                         cd app && npm run preflight"
echo "  5. Sobe stack:                   docker compose -f docker-compose.prod.yml up -d"
