# Deploying Lead-Pipeline to Hostinger (VPS + GitHub)

The CRM is a Vite SPA plus a Bun/Express API. The Node API lives at `server/index.ts` and in production it serves the pre-built `dist/` directory as static files, so a single Node process runs everything. PM2 keeps it alive across reboots; Caddy terminates TLS and proxies to the API on `localhost:3002`.

This doc assumes a fresh Hostinger VPS (KVM 1 or higher) on Ubuntu 22.04 LTS or 24.04 LTS. A domain you control (A/CNAME pointed at the VPS IP).

---

## 1. One-time VPS bootstrap (run as root over SSH)

```bash
# System updates + Node + utilities
apt update && apt -y upgrade
apt -y install curl git unzip build-essential ca-certificates

# Bun (the runtime that runs the API + migrations + scripts)
curl -fsSL https://bun.sh/install | bash
# Either restart your shell or:
export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"

# Node 20 (PM2 needs it even though the app runs on bun)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs

# PM2 + the startup hook so the process survives a reboot
npm i -g pm2
pm2 startup systemd -u $USER --hp $HOME   # follow the printed `sudo` line
# (re-run this command as the user that will own the app, not as root)

# Caddy for auto-HTTPS reverse proxy
apt -y install caddy
```

Create app dir + log dir, owned by the user that will run the app (NOT root):

```bash
APP_USER="deploy"   # or any non-root account you use
sudo useradd -m -s /bin/bash "$APP_USER" || true
sudo mkdir -p /var/www/lead-pipeline /var/log/lead-pipeline
sudo chown -R "$APP_USER":"$APP_USER" /var/www /var/log/lead-pipeline
```

## 2. Initial clone (as the deploy user)

```bash
sudo -u "$APP_USER" -H bash <<'EOF'
git clone https://github.com/mlsjahidcn-sudo/Lead-Pipeline.git /var/www/lead-pipeline
cd /var/www/lead-pipeline
bun install --frozen-lockfile
bun run build
bun run migrate       # only if the repo has server/migrate.ts
EOF
```

Populate the production `.env` (NEON connection, Better Auth secret, trusted origins, Bet­ter Auth URL pointing at the public domain). The contents mirror `.env.example`:

```bash
sudo -u "$APP_USER" -H bash <<'EOF'
sudo -e /var/www/lead-pipeline/.env   # opens the editor; paste:
#   DATABASE_URL="postgresql://neondb_owner:npg_***@ep-***-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
#   NEON_AUTH_JWKS_URL=https://ep-***.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth/.well-known/jwks.json
#   NEON_AUTH_ISSUER=https://ep-***.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth
#   PORT=3002
#   BETTER_AUTH_SECRET="<openssl rand -hex 32>"
#   BETTER_AUTH_URL="https://crm.yourdomain.com"
#   TRUSTED_ORIGINS="https://crm.yourdomain.com"
#   NEON_BRANCH=production
EOF
chmod 600 /var/www/lead-pipeline/.env
```

Start the app under PM2 and save the process list:

```bash
sudo -u "$APP_USER" -H bash <<'EOF'
cd /var/www/lead-pipeline
pm2 start ecosystem.config.cjs --only crm
pm2 save
EOF
```

Smoke-check the API directly (ignore the certificate warning, Caddy handles TLS):

```bash
curl -s http://localhost:3002/api/health
# -> {"ok":true,"db":"up","time":"…"} if the NEON connection works
```

## 3. Caddy reverse proxy with auto-HTTPS

Replace `/etc/caddy/Caddyfile`:

```
crm.yourdomain.com {
  encode zstd gzip
  reverse_proxy localhost:3002
}
```

Reload and confirm the certificate came up:

```bash
systemctl reload caddy
systemctl status caddy --no-pager
```

## 4. Hostinger Git ↔ GitHub bridge

Two paths — pick the one that matches your hPanel:

### A. Hostinger's built-in `Website → Git` (only on Cloud / some VPS plans)

In hPanel → Website → Git:

| Field                | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| Repository URL       | `https://github.com/mlsjahidcn-sudo/Lead-Pipeline.git`    |
| Branch               | `main`                                                    |
| Install path         | `/var/www/lead-pipeline`                                  |
| Auto-update          | enabled                                                   |
| Build command        | leave empty (we build on the VPS via deploy.sh)           |

Hostinger will clone on save. Configure auto-update to call our webhook so the build + PM2 reload runs (Hostinger's auto-update runs its own build pipeline which doesn't know about Bun, so point it at a webhook URL — see path B for the script).

### B. GitHub → VPS webhook (cleanest, full control)

On the GitHub repo: **Settings → Webhooks → Add**:

| Field         | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Payload URL   | `https://crm.yourdomain.com/deploy-hook` (or a VPS-internal URL behind a basic-auth proxy) |
| Content type  | `application/json`                                         |
| Secret        | an `openssl rand -hex 32` string you put in `WEBHOOK_SECRET` below |
| Events        | "Just the push event"                                      |

On the VPS, install the tiny `github-webhook` listener (the lightweight option that doesn't need Node-only):

```bash
sudo apt -y install webhook
sudo tee /etc/webhook.conf <<'YAML' >/dev/null
[{
  "id": "deploy",
  "execute-command": "/var/www/lead-pipeline/deploy.sh",
  "include-command-output-in-response": true,
  "include-command-output-on-error": true,
  "response-message": "deploy triggered"
}]
YAML
sudo tee /etc/systemd/system/webhook.service <<'UNIT' >/dev/null
[Unit]
Description=GitHub webhook listener
After=network.target
[Service]
ExecStart=/usr/bin/webhook -hooks=/etc/webhook.conf -port=9000 -secure -cert=/etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem -key=/etc/letsencrypt/live/crm.yourdomain.com/privkey.pem
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now webhook
```

Then a tiny Caddy snippet in `/etc/caddy/Caddyfile` to forward `/deploy-hook`:

```
crm.yourdomain.com {
  reverse_proxy /deploy-hook localhost:9000
  reverse_proxy localhost:3002
}
```

`systemctl reload caddy`. Every push to `main` now triggers `deploy.sh` on the VPS.

## 5. Neon auth + IP allowlist

The Neon DB has `block_public_connections=false` and `allowed_ips=[]` (from `projects list`). Add the VPS's public IP so direct (unpooled) connections from the API process are accepted, or just rely on the pooler (which is already public).

```bash
# once you have the VPS IP:
curl -X POST "https://console.neon.tech/api/v2/projects/soft-dust-81481051/ip_allow" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ips":["203.0.113.42"]}'
```

## 6. Neon Auth trusted domains

Sign-ins fail with `invalid domain` unless the production hostname is registered:

```bash
# from your laptop or anywhere with NEON_API_KEY:
NEON_API_KEY="napi_…" neon neon-auth domain add https://crm.yourdomain.com
```

## 7. Smoke checks

```bash
# 1. API direct
curl -s http://localhost:3002/api/health

# 2. Front of the site
curl -sI https://crm.yourdomain.com | head

# 3. Auth handshake
curl -s https://crm.yourdomain.com/api/auth/get-session | head

# 4. Force a deploy
sudo -u "$APP_USER" /var/www/lead-pipeline/deploy.sh
```

---

## Day-to-day operations

| Task                     | Command                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Tail live logs           | `pm2 logs crm`                                                                                |
| Tail historical logs     | `tail -f /var/log/lead-pipeline/crm.out.log`                                                  |
| Restart after env change | `pm2 reload crm --update-env`                                                                 |
| Open Bun REPL with env   | `cd /var/www/lead-pipeline && bun --print '$env'`                                             |
| Inspect the DB           | `PGPASSWORD=npg_… bun --print 'await (await import("pg")).default.Client.connect(process.env.DATABASE_URL).then(c => c.query("select now()")).then(r => r.rows)'` |
| Roll back a bad push     | `cd /var/www/lead-pipeline && git reset --hard <last-good-sha> && pm2 reload crm`             |

## Reference: files added by this change

- `deploy.sh` — webhook-driven, idempotent pull + build + reload
- `ecosystem.config.cjs` — PM2 process file (`crm` app on `:3002`)
- `DEPLOY_HOSTINGER.md` — this runbook
- `server/index.ts` — now also serves `dist/` static + SPA fallback
- `package.json` — adds `start` (`vite build && bun run server/index.ts`) and `serve` (`bun run server/index.ts`)
