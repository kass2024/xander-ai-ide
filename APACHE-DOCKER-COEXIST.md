# Apache + Docker coexistence (VPS with existing Apache vhosts)

When your VPS already runs **Apache** for sites like `parrotcanada.site`, `parrotmoc.online`, etc., do **not** let Docker Nginx bind public ports **80/443**.

## Architecture

```
Internet :443/:80
    └── Apache (only public listener)
            ├── parrotcanada.site  → existing DocumentRoot
            ├── parrotmoc.online   → existing DocumentRoot
            ├── xanderbot.site     → existing DocumentRoot
            └── xanderai.online    → ProxyPass http://127.0.0.1:8088/
                    └── Docker xander_nginx :8088 → web + backend
```

## One-command fix (on VPS)

```bash
cd /opt/xander-ai-ide
git pull
sudo bash scripts/fix-apache-docker-coexist.sh
```

The script will:

1. Audit `xander_nginx`, compose files, and Apache vhosts
2. Stop Docker from using host **80/443**
3. Recreate Nginx on **`127.0.0.1:8088`** only
4. Install Apache vhost **`apache/xanderai-online.conf`** (Xander domains only)
5. Verify ports and health checks

## Manual compose (after fix)

```bash
cd /opt/xander-ai-ide
export NGINX_CONFIG=./nginx.apache-proxy.conf
docker compose -f docker-compose.prod.yml \
  -f docker-compose.apache-proxy.yml \
  --env-file .env.production up -d
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.apache-proxy.yml` | Nginx on `127.0.0.1:8088`, no 443 |
| `nginx.apache-proxy.conf` | HTTP-only nginx behind Apache SSL |
| `apache/xanderai-online.conf` | Apache SSL + reverse proxy for Xander |
| `scripts/fix-apache-docker-coexist.sh` | Automated migration |

## SSL certificates (enable HTTPS)

HTTP works but browser shows **Not secure** until Apache has Let's Encrypt certs for `xanderai.online`.

**One command:**

```bash
cd /opt/xander-ai-ide
git pull
sudo bash scripts/setup-ssl-apache.sh
```

The script uses webroot validation (Apache keeps port 80), installs SSL vhosts, and reloads Apache. Other domain certs are not touched.

**Manual:**

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/html \
  -d xanderai.online -d www.xanderai.online -d api.xanderai.online \
  --email admin@xanderai.online --agree-tos --no-eff-email
sudo cp /opt/xander-ai-ide/apache/xanderai-online.conf /etc/apache2/sites-available/
sudo a2enmod ssl && sudo systemctl reload apache2
```

Verify:

```bash
curl -I https://xanderai.online
curl https://api.xanderai.online/health
```

- **Existing Apache certs** for parrot/xanderbot domains are **not touched**.
- If certs only exist in Docker certbot (`certbot/conf/`), `setup-ssl-apache.sh` symlinks them automatically.

## Wrong site on xanderai.online (e.g. Parrot Canada)

Apache is working, but **no vhost proxies xanderai.online to Docker** — traffic falls through to your default/Parrot vhost.

Fix (Docker on 8088 + Apache proxy only for Xander):

```bash
cd /opt/xander-ai-ide
git pull
sudo bash scripts/vps-docker-8088-recover.sh
```

Quick check:

```bash
apachectl -S | grep -i xanderai          # must show xanderai vhosts
docker ps --filter name=xander_nginx      # must show 127.0.0.1:8088->80
curl -H "Host: api.xanderai.online" http://127.0.0.1:8088/health
grep -r xanderai /etc/apache2/sites-enabled/   # must NOT be only in parrot config
```

If `xanderai.online` appears inside a **parrot** vhost as `ServerAlias`, remove it from that file and reload Apache.


## Where full stack is defined

The complete production stack (postgres, redis, qdrant, backend, web, nginx) is in:

- **`docker-compose.prod.yml`** (repo root — not `/opt/xander-ai-ide/docker-compose.yml` which is dev DB only)

Find running compose source on server:

```bash
docker inspect xander_nginx --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```
