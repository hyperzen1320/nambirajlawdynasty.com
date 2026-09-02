# 🏛️ LegalEasy — Self-Hosting Guide (On-Prem + Cloudflare Tunnel)

Run the whole app on your **own office server** with a **local MongoDB**,
reachable **globally** over HTTPS — without opening a single port on the
office router.

> Why this shape? The database never leaves the building (it's bound
> inside Docker, no public port). The only thing that touches the
> internet is one **outbound** Cloudflare Tunnel connection. For
> confidential client case-data, that's the safest posture you can run.

```
        🌍 Internet
            │  HTTPS, terminated at Cloudflare's edge
            ▼
     ┌──────────────┐     outbound tunnel only
     │  Cloudflare   │◀───────────────────────────┐
     └──────────────┘                             │
                                        ┌──────────┴───────────┐
                                        │  cloudflared (Docker) │
                                        └──────────┬───────────┘
                                                   │ http://app:3000
                                        ┌──────────▼───────────┐
                                        │  app  (Next.js)       │
                                        └──────────┬───────────┘
                                                   │ mongodb://mongo:27017
                                        ┌──────────▼───────────┐
                                        │  mongo  (local only)  │  ← no public port
                                        └──────────────────────┘
                                            🏢 office server
```

---

## ✅ Prerequisites

- An **Ubuntu/Debian** server you can SSH into (the office box).
- A **domain on Cloudflare** (e.g. `yourfirm.in`) — free plan is fine.
- The current **`AUTH_SECRET`** value from the Vercel project
  (Vercel → Project → Settings → Environment Variables). Copy it now.
- The **Atlas connection string** (for the one-time data migration).

---

## 1️⃣ Install Docker on the server

```bash
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"     # run docker without sudo
# log out and back in (or: newgrp docker) so the group takes effect
docker --version && docker compose version
```

---

## 2️⃣ Get the code onto the server

```bash
sudo mkdir -p /opt/legaleasy && sudo chown "$USER" /opt/legaleasy
git clone <your-repo-url> /opt/legaleasy
cd /opt/legaleasy
```

---

## 3️⃣ Configure the environment

```bash
cp .env.example .env
nano .env          # fill in the three real values
```

Set:
- `MONGODB_URI=mongodb://mongo:27017/legaleasy` (leave as-is unless your
  restored DB uses a different name — see step 5).
- `AUTH_SECRET=` → **paste the exact value from Vercel**. Reusing it keeps
  every existing mobile-app login valid; a new secret signs everyone out.
- `TUNNEL_TOKEN=` → filled in the next step.

`.env` is git-ignored — it holds secrets and must never be committed.

---

## 4️⃣ Create the Cloudflare Tunnel

1. **Cloudflare Zero Trust** dashboard → **Networks → Tunnels → Create a
   tunnel** → choose **Cloudflared**.
2. Name it (e.g. `legaleasy-office`) → **Save**. Copy the **token** it
   shows and paste it into `.env` as `TUNNEL_TOKEN`.
3. On that tunnel, add a **Public Hostname**:
   - **Subdomain / domain**: e.g. `app.yourfirm.in`
   - **Service → Type**: `HTTP`
   - **Service → URL**: `app:3000`  ← the compose service name, not localhost
4. Save. Cloudflare auto-creates the DNS record and the TLS cert.

> Auth.js is already set with `trustHost: true`, so it honours the
> `X-Forwarded-Host` / `X-Forwarded-Proto` headers Cloudflare sends — no
> `AUTH_URL` to configure. Logins "just work" on the new hostname.

---

## 5️⃣ Migrate the data from Atlas → local

Do this **at a quiet time** so users aren't writing to Atlas during the
cutover.

```bash
# (a) On any machine that can reach Atlas — your laptop is fine:
mongodump --uri="<ATLAS_CONNECTION_STRING>" --archive=legaleasy.archive --gzip

# (b) Copy the archive to the server:
scp legaleasy.archive <user>@<server>:/opt/legaleasy/

# (c) On the server, start ONLY the database first:
cd /opt/legaleasy
docker compose up -d mongo

# (d) Restore into the container (confirm the name with `docker compose ps`):
docker exec -i legaleasy-mongo-1 \
  mongorestore --archive --gzip --drop < legaleasy.archive
```

`mongorestore` preserves the **source database name**. If your Atlas DB
isn't called `legaleasy`, either keep that name in `MONGODB_URI`, or
remap on restore with `--nsFrom='<old>.*' --nsTo='legaleasy.*'`.

> Starting fresh instead of migrating? Skip this step — the seed scripts
> in step 7 create the first admin and the plan catalogue.

---

## 6️⃣ Launch

```bash
cd /opt/legaleasy
docker compose up -d --build      # build the app image + start all three
docker compose ps                 # mongo healthy, app + cloudflared up
docker compose logs -f app        # watch it boot; Ctrl-C to stop tailing
```

Open `https://app.yourfirm.in` — you should get the login page over HTTPS.

---

## 7️⃣ First admin (fresh installs only)

If you migrated in step 5, your existing logins already work — skip this.
For an empty DB, seed inside the running app container:

```bash
docker compose exec app npm run seed:plans     # subscription catalogue
docker compose exec app npm run seed:admin     # the first global admin
```

> The seed scripts read `.env.local`; in the container they fall back to
> the process env from `.env`, so they pick up `MONGODB_URI` correctly.

---

## 8️⃣ Automated backups (do not skip)

```bash
chmod +x scripts/backup-mongo.sh
crontab -e
# nightly at 02:30:
30 2 * * *  /opt/legaleasy/scripts/backup-mongo.sh >> /var/log/legaleasy-backup.log 2>&1
```

Then **copy the archives off the server** (NAS / encrypted bucket). A
backup on the same disk as the DB protects against nothing.

---

## 9️⃣ Point the mobile app at the new home

The Expo app's API base comes from `EXPO_PUBLIC_API_URL`. Set it to the
new hostname and rebuild, or the phones keep calling the old Vercel URL:

```bash
# in the mobile app, e.g. eas.json / build profile env:
EXPO_PUBLIC_API_URL=https://app.yourfirm.in
# then: eas build --profile production --platform android   (and/or ios)
```

---

## 🔄 Updating the app later

```bash
cd /opt/legaleasy
git pull
docker compose up -d --build      # rebuilds app, leaves mongo + volume intact
```

Mongoose builds any new indexes (e.g. the CNR-uniqueness index) on boot.

---

## 🔐 Security checklist

- [ ] **Rotate the dev SSH passwords** and switch to **SSH keys**; disable
      password auth (`PasswordAuthentication no` in `/etc/ssh/sshd_config`).
- [ ] **Firewall**: allow only SSH (ideally key-only, IP-restricted). The
      app needs **no inbound ports** — Cloudflare reaches it via the
      outbound tunnel. `sudo ufw allow OpenSSH && sudo ufw enable`.
- [ ] Mongo has **no published port** (it isn't in compose `ports:`) —
      keep it that way; never expose 27017.
- [ ] `.env` stays out of git (already in `.gitignore`).
- [ ] Backups are **encrypted** and stored **off the server**.
- [ ] Consider Cloudflare **Access** in front of the app for an extra
      auth layer (Zero Trust → Access → Applications).

---

## ↩️ Rollback

Vercel + Atlas stay running until you flip the mobile `EXPO_PUBLIC_API_URL`
and any web DNS. If anything's off, point clients back at the Vercel URL —
nothing here deletes the old setup. Cut over only once the self-hosted
stack is verified.

---

## 🧰 Handy commands

```bash
docker compose ps                       # status
docker compose logs -f app              # app logs
docker compose logs -f cloudflared      # tunnel logs (connection issues)
docker compose restart app              # restart just the app
docker compose down                     # stop all (volume/data preserved)
docker exec -it legaleasy-mongo-1 mongosh legaleasy   # poke the DB
```
