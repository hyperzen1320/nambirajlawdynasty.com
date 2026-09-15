# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────
# Self-hosting image for LegalEasy (Next.js 16).
#
# Design choice worth knowing: we ship the FULL node_modules and run
# `next start`, rather than Next's output:"standalone" trace. The case-
# export pipeline (pdfkit / exceljs / docx) loads non-JS data files at
# runtime — pdfkit reads Helvetica.afm and the other AFM metrics files.
# Next's standalone file-tracer is known to drop those data files (it's
# the very bug that 500'd the PDF export on Vercel), so keeping the real
# node_modules is the reliable choice. On a single on-prem server the
# extra image size is irrelevant; a PDF export that actually works is
# not. None of these packages have native addons (bcryptjs/exceljs/docx/
# pdfkit are all pure JS), so copying node_modules across stages is safe.
# ─────────────────────────────────────────────────────────────────────

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- builder: install deps + compile ----
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install against the lockfile first so this layer caches until deps
# actually change.
COPY package.json package-lock.json ./
RUN npm ci

# Compile. Every route is force-dynamic or an API handler, so `next
# build` never touches MongoDB — no MONGODB_URI is needed at build time.
# `mkdir -p public` guarantees the COPY below succeeds even though the
# repo currently ships no public/ directory.
COPY . .
RUN mkdir -p public && npm run build

# ---- runner: lean runtime with the built app ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Own the files with the image's built-in unprivileged `node` user so
# `next start` can write its image-optimisation cache under .next/cache.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node

EXPOSE 3000
# Bind to 0.0.0.0 so the cloudflared sidecar can reach the app across the
# compose network as `app:3000`.
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
