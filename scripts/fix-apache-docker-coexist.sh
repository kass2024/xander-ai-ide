#!/usr/bin/env bash
# Fix Apache + Docker port conflict on VPS
# Apache keeps 80/443 for all existing vhosts; Docker Nginx moves to 127.0.0.1:8088
#
# Run on VPS as root or with sudo:
#   cd /opt/xander-ai-ide && git pull && sudo bash scripts/fix-apache-docker-coexist.sh
#
set -euo pipefail

XANDER_ROOT="${XANDER_ROOT:-/opt/xander-ai-ide}"
APACHE_SITE="xanderai-online.conf"
APACHE_AVAILABLE="/etc/apache2/sites-available/${APACHE_SITE}"
DOCKER_PORT="${DOCKER_NGINX_PORT:-8088}"
DOMAIN="${DOMAIN:-xanderai.online}"
API_DOMAIN="${API_DOMAIN:-api.xanderai.online}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }
die()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "Run as root: sudo bash $0"
  fi
}

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    cp -a "$f" "${f}.bak.$(date +%Y%m%d-%H%M%S)"
    log "Backed up $f"
  fi
}

section_audit() {
  log "=== 1. Audit Docker / Apache ==="

  echo "--- docker ps (xander) ---"
  docker ps -a --filter name=xander --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true

  echo "--- port 80/443 listeners ---"
  ss -tulpn | grep -E ':80 |:443 ' || true

  echo "--- apache vhosts ---"
  apachectl -S 2>&1 || apache2ctl -S 2>&1 || true

  if docker inspect xander_nginx >/dev/null 2>&1; then
    echo "--- xander_nginx compose project ---"
    docker inspect xander_nginx --format 'ComposeProject={{index .Config.Labels "com.docker.compose.project"}}
ComposeFile={{index .Config.Labels "com.docker.compose.project.config_files"}}
WorkingDir={{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>/dev/null || true

    echo "--- xander_nginx port bindings ---"
    docker inspect xander_nginx --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || true

    echo "--- xander_nginx config mounts ---"
    docker inspect xander_nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null || true
  else
    warn "Container xander_nginx not found"
  fi

  echo "--- compose files under /opt ---"
  find /opt -maxdepth 4 \( -name 'docker-compose.yml' -o -name 'compose.yml' -o -name 'docker-compose.*.yml' \) 2>/dev/null || true

  echo "--- systemd xander units ---"
  systemctl list-units --type=service --all 2>/dev/null | grep -i xander || echo "(none)"

  echo "--- systemd docker units ---"
  systemctl list-units --type=service --all 2>/dev/null | grep -i docker | head -5 || true
}

find_xander_compose_dir() {
  if [ -d "$XANDER_ROOT" ] && [ -f "$XANDER_ROOT/docker-compose.prod.yml" ]; then
    echo "$XANDER_ROOT"
    return 0
  fi

  if docker inspect xander_nginx >/dev/null 2>&1; then
    local wd
    wd=$(docker inspect xander_nginx --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>/dev/null || true)
    if [ -n "$wd" ] && [ -f "$wd/docker-compose.prod.yml" ]; then
      echo "$wd"
      return 0
    fi
  fi

  local found
  found=$(find /opt /root /home -maxdepth 5 -name 'docker-compose.prod.yml' 2>/dev/null | head -1 || true)
  if [ -n "$found" ]; then
    dirname "$found"
    return 0
  fi

  die "Could not find docker-compose.prod.yml — set XANDER_ROOT=/path/to/xander-ai-ide"
}

detect_ssl_cert_dir() {
  if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "/etc/letsencrypt/live/${DOMAIN}"
    return 0
  fi
  if [ -f "${XANDER_ROOT}/certbot/conf/live/${DOMAIN}/fullchain.pem" ]; then
    echo "${XANDER_ROOT}/certbot/conf/live/${DOMAIN}"
    return 0
  fi
  return 1
}

install_apache_certs_from_docker() {
  local docker_cert="${XANDER_ROOT}/certbot/conf/live/${DOMAIN}/fullchain.pem"
  if [ ! -f "$docker_cert" ]; then
    return 1
  fi
  warn "System cert not found — linking Docker certbot certs into Apache letsencrypt path"
  mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
  ln -sf "${XANDER_ROOT}/certbot/conf/live/${DOMAIN}/fullchain.pem" "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  ln -sf "${XANDER_ROOT}/certbot/conf/live/${DOMAIN}/privkey.pem" "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
  if [ -f "${XANDER_ROOT}/certbot/conf/options-ssl-apache.conf" ]; then
    cp -n "${XANDER_ROOT}/certbot/conf/options-ssl-apache.conf" /etc/letsencrypt/options-ssl-apache.conf 2>/dev/null || true
  fi
  if [ ! -f /etc/letsencrypt/options-ssl-apache.conf ]; then
    cat > /etc/letsencrypt/options-ssl-apache.conf <<'EOF'
SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
SSLHonorCipherOrder off
SSLSessionTickets off
EOF
  fi
  return 0
}

patch_env_production() {
  local env_file="${XANDER_ROOT}/.env.production"
  if [ ! -f "$env_file" ]; then
    warn ".env.production missing — create from .env.production.example before starting stack"
    return 0
  fi
  backup_file "$env_file"
  grep -q '^NGINX_CONFIG=' "$env_file" && sed -i 's|^NGINX_CONFIG=.*|NGINX_CONFIG=./nginx.apache-proxy.conf|' "$env_file" || echo 'NGINX_CONFIG=./nginx.apache-proxy.conf' >> "$env_file"
  grep -q '^DOCKER_NGINX_PORT=' "$env_file" || echo "DOCKER_NGINX_PORT=${DOCKER_PORT}" >> "$env_file"
  log "Updated $env_file (NGINX_CONFIG=./nginx.apache-proxy.conf)"
}

recreate_docker_nginx() {
  log "=== 3. Recreate Docker stack (Nginx on 127.0.0.1:${DOCKER_PORT} only) ==="
  cd "$XANDER_ROOT"

  if [ ! -f docker-compose.apache-proxy.yml ]; then
    die "Missing docker-compose.apache-proxy.yml — run: cd $XANDER_ROOT && git pull"
  fi
  if [ ! -f nginx.apache-proxy.conf ]; then
    die "Missing nginx.apache-proxy.conf — run git pull"
  fi

  local env_args=()
  if [ -f .env.production ]; then
    env_args=(--env-file .env.production)
  fi

  # Stop nginx binding 80/443 without tearing down DB volumes
  if docker inspect xander_nginx >/dev/null 2>&1; then
    log "Stopping xander_nginx (freeing ports 80/443)..."
    docker stop xander_nginx 2>/dev/null || true
    docker rm xander_nginx 2>/dev/null || true
  fi

  export NGINX_CONFIG=./nginx.apache-proxy.conf

  log "Starting stack with Apache proxy override..."
  docker compose -f docker-compose.prod.yml -f docker-compose.apache-proxy.yml "${env_args[@]}" up -d --build

  log "Waiting for backend health..."
  local i
  for i in $(seq 1 30); do
    if docker exec xander_backend wget -qO- http://localhost:3001/health/live >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done

  docker compose -f docker-compose.prod.yml -f docker-compose.apache-proxy.yml "${env_args[@]}" ps
}

configure_apache() {
  log "=== 4. Configure Apache reverse proxy (Xander domains only) ==="

  if ! command -v apache2 >/dev/null 2>&1 && ! command -v apachectl >/dev/null 2>&1; then
    die "Apache not installed — existing vhosts require Apache; install apache2 first"
  fi

  a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite 2>/dev/null || true

  if ! detect_ssl_cert_dir >/dev/null 2>&1; then
    if ! install_apache_certs_from_docker; then
      warn "No SSL cert for ${DOMAIN} yet."
      warn "After this script, run (Apache must own port 80):"
      warn "  certbot certonly --webroot -w /var/www/html -d ${DOMAIN} -d www.${DOMAIN} -d ${API_DOMAIN}"
      warn "Or: certbot --apache -d ${DOMAIN} -d www.${DOMAIN} -d ${API_DOMAIN}"
    fi
  fi

  if [ ! -f "${XANDER_ROOT}/apache/${APACHE_SITE}" ]; then
    die "Missing ${XANDER_ROOT}/apache/${APACHE_SITE} — git pull"
  fi

  backup_file "$APACHE_AVAILABLE"
  cp "${XANDER_ROOT}/apache/${APACHE_SITE}" "$APACHE_AVAILABLE"

  # Patch cert paths if using non-standard location (symlinks above should work)
  if detect_ssl_cert_dir >/dev/null 2>&1; then
    local cert_dir
    cert_dir=$(detect_ssl_cert_dir)
    sed -i "s|/etc/letsencrypt/live/${DOMAIN}|${cert_dir}|g" "$APACHE_AVAILABLE"
  fi

  a2ensite "${APACHE_SITE}" 2>/dev/null || true

  log "Testing Apache config..."
  apachectl configtest

  systemctl enable apache2 2>/dev/null || true
  systemctl start apache2 2>/dev/null || true
  systemctl reload apache2 2>/dev/null || systemctl restart apache2

  # Ensure host nginx stays disabled if it was competing
  systemctl stop nginx 2>/dev/null || true
  systemctl disable nginx 2>/dev/null || true
}

verify_fix() {
  log "=== 5. Verification ==="

  echo "--- Apache vhosts (all domains should still appear) ---"
  apachectl -S 2>&1 | head -60

  echo ""
  echo "--- Port 80/443 (expect Apache only, NOT docker-proxy) ---"
  ss -tulpn | grep -E ':80 |:443 ' || true

  echo ""
  echo "--- Docker xander_nginx (expect 127.0.0.1:${DOCKER_PORT}->80 only) ---"
  docker ps --filter name=xander_nginx --format 'table {{.Names}}\t{{.Ports}}'

  echo ""
  echo "--- Internal Docker health ---"
  curl -sf -H "Host: ${API_DOMAIN}" "http://127.0.0.1:${DOCKER_PORT}/health" && echo " OK api via docker nginx" || warn "API via :${DOCKER_PORT} failed"
  curl -sf -H "Host: ${DOMAIN}" "http://127.0.0.1:${DOCKER_PORT}/" -o /dev/null && echo " OK web via docker nginx" || warn "Web via :${DOCKER_PORT} failed"

  echo ""
  echo "--- Apache proxy health (if SSL ready) ---"
  curl -sfk "https://${DOMAIN}/" -o /dev/null && echo " OK https://${DOMAIN}" || warn "https://${DOMAIN} not ready (cert/DNS?)"
  curl -sfk "https://${API_DOMAIN}/health" && echo " OK https://${API_DOMAIN}/health" || warn "https://${API_DOMAIN}/health not ready"

  echo ""
  log "Done. Other vhosts (parrotcanada.site, parrotmoc.online, etc.) should work via Apache again."
  log "Xander: https://${DOMAIN}  API: https://${API_DOMAIN}"
}

main() {
  require_root
  section_audit

  log "=== 2. Locate Xander compose project ==="
  XANDER_ROOT=$(find_xander_compose_dir)
  log "Using XANDER_ROOT=$XANDER_ROOT"

  patch_env_production
  recreate_docker_nginx
  configure_apache
  verify_fix
}

main "$@"
