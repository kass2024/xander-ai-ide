#!/usr/bin/env bash
# Enable HTTPS for xanderai.online via Apache (Docker stays on 127.0.0.1:8088)
# Does NOT stop Apache or bind Docker to 80/443.
#
# Run on VPS:
#   cd /opt/xander-ai-ide && sudo bash scripts/setup-ssl-apache.sh
#
set -euo pipefail

ROOT="${XANDER_ROOT:-/opt/xander-ai-ide}"
DOMAIN="${DOMAIN:-xanderai.online}"
API_DOMAIN="${API_DOMAIN:-api.xanderai.online}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
WEBROOT="${WEBROOT:-/var/www/html}"
APACHE_SITE="/etc/apache2/sites-available/xanderai-online.conf"

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run: sudo bash $0"

# --- Apache modules ---
a2enmod ssl headers proxy proxy_http proxy_wstunnel rewrite 2>/dev/null || true

mkdir -p "${WEBROOT}/.well-known/acme-challenge"
chown -R www-data:www-data "${WEBROOT}/.well-known" 2>/dev/null || true

# --- options-ssl-apache.conf (required by our vhost) ---
if [ ! -f /etc/letsencrypt/options-ssl-apache.conf ]; then
  log "Installing options-ssl-apache.conf..."
  if [ -f /usr/share/doc/python3-certbot-apache/examples/options-ssl-apache.conf ]; then
    cp /usr/share/doc/python3-certbot-apache/examples/options-ssl-apache.conf /etc/letsencrypt/options-ssl-apache.conf
  else
    mkdir -p /etc/letsencrypt
    cat > /etc/letsencrypt/options-ssl-apache.conf <<'EOF'
SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
SSLHonorCipherOrder off
SSLSessionTickets off
EOF
  fi
fi

# --- Bootstrap HTTP vhost (proxy on 80, no HTTPS redirect) while obtaining cert ---
bootstrap_apache() {
  log "Installing temporary HTTP-only vhost (proxy + ACME, no redirect)..."
  cat > "$APACHE_SITE" <<EOF
# Temporary bootstrap — replaced after SSL cert issued
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN} ${API_DOMAIN}

    DocumentRoot ${WEBROOT}
    Alias /.well-known/acme-challenge/ ${WEBROOT}/.well-known/acme-challenge/
    <Directory ${WEBROOT}/.well-known/acme-challenge/>
        Require all granted
    </Directory>

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
    ProxyPass /.well-known/acme-challenge/ !
    ProxyPass        / http://127.0.0.1:8088/
    ProxyPassReverse / http://127.0.0.1:8088/
</VirtualHost>
EOF
  a2ensite xanderai-online.conf 2>/dev/null || true
  apachectl configtest
  systemctl reload apache2
}

install_full_apache_vhost() {
  log "Installing full SSL vhost from repo..."
  [ -f "${ROOT}/apache/xanderai-online.conf" ] || die "Missing ${ROOT}/apache/xanderai-online.conf — git pull"
  cp -a "$APACHE_SITE" "${APACHE_SITE}.pre-ssl.bak.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  cp "${ROOT}/apache/xanderai-online.conf" "$APACHE_SITE"
  apachectl configtest
  systemctl reload apache2
}

# --- Try existing certs (Docker certbot or system) ---
use_existing_certs() {
  if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    log "System cert already exists at /etc/letsencrypt/live/${DOMAIN}/"
    return 0
  fi
  local docker_cert="${ROOT}/certbot/conf/live/${DOMAIN}/fullchain.pem"
  if [ -f "$docker_cert" ]; then
    log "Linking existing Docker certbot certs into Apache path..."
    mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
    ln -sf "${ROOT}/certbot/conf/live/${DOMAIN}/fullchain.pem" "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    ln -sf "${ROOT}/certbot/conf/live/${DOMAIN}/privkey.pem" "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
    ln -sf "${ROOT}/certbot/conf/live/${DOMAIN}/chain.pem" "/etc/letsencrypt/live/${DOMAIN}/chain.pem" 2>/dev/null || true
    return 0
  fi
  return 1
}

obtain_cert() {
  log "Requesting Let's Encrypt certificate (webroot, Apache stays on port 80)..."
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y certbot
  fi

  certbot certonly --webroot -w "$WEBROOT" \
    -d "$DOMAIN" -d "www.${DOMAIN}" -d "$API_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --no-eff-email \
    -n \
    --non-interactive \
    || die "Certbot failed. Check DNS A records for ${DOMAIN}, www.${DOMAIN}, ${API_DOMAIN}"
}

# --- Main ---
log "Domain: ${DOMAIN} / ${API_DOMAIN}"

if use_existing_certs; then
  log "Using existing certificate."
else
  bootstrap_apache
  obtain_cert
fi

install_full_apache_vhost

log "Testing HTTPS..."
sleep 2
curl -sfI "https://${DOMAIN}/" | head -5 || warn "https://${DOMAIN} not responding yet"
curl -sf "https://${API_DOMAIN}/health" && echo " OK api health" || echo "WARN: api health check failed"

echo ""
log "HTTPS enabled for ${DOMAIN}"
echo "  https://${DOMAIN}"
echo "  https://${API_DOMAIN}/health"
echo ""
echo "Renewal (add to crontab if missing):"
echo "  0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload apache2'"
