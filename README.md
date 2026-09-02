<div align="center">

# ⚖️ LegalEasy

### _The advocate office, finally on your screen._

**Case Vault · Hearing Track · Client Crew · Court Hub · AI Assistant · Work Flow · Live canvas · RBAC team**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=000)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-13AA52?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Auth.js v5](https://img.shields.io/badge/Auth.js-v5-000000?style=for-the-badge)](https://authjs.dev)

![Phase](https://img.shields.io/badge/phase-2%20Live%20Collab-c5853a?style=flat-square)
![Region](https://img.shields.io/badge/region-Mumbai%20%E2%80%A2%20IN-1f4e54?style=flat-square)
![License](https://img.shields.io/badge/license-Proprietary-6b2737?style=flat-square)
![Maintained](https://img.shields.io/badge/maintained-yes-3a5a40?style=flat-square)

</div>

---


## 🪶 What is this?

A practising advocate's life is twelve open tabs, three diaries, a WhatsApp signal storm, and a stack of yellow files. **LegalEasy** collapses all of that into a single office workspace — designed for Indian legal practice, written like a love letter to good design.

Two clients, one backend, one MongoDB:

- 🖥️ **Web app** _(this repo)_ — Next.js 16 partner-side console
- 📱 **Mobile app** — Expo SDK 54 → [`LegalEasyMobileApp`](https://github.com/hyperzen1320/LegalEasyMobileApp)

Both share the same Mongo, the same role-based access, the same advocate office.

---

## 🎨 The aesthetic — _Midnight Counsel_

| | |
|---|---|
| 🟫 **Canvas** | `#f4ede0` — warm cream paper |
| ⚫ **Ink** | `#0a1124` — courtroom-navy |
| 🟠 **Copper** | `#c5853a` — gilded brass accents |
| 🤍 **Ivory** | `#f5ebd6` — soft highlight |
| 🌊 **Aqua** | `#56a0a8` — status pills |

Typography: **Crimson Pro** (display) · **Manrope** (body) · **DM Mono** (caps & metadata)

> _"The look of a good chambers — paper, brass, leather-bound, and quietly confident."_

---

## ✨ Features

### 📁 Case Vault
- Full case record: file no., case no., I.A. numbers, CNR, parties, court + hall + place, status, hearing dates
- Six-stage hearing dropdown — **Filed · Notice · Evidence · Arguments · Reserved · Disposed**
- Hearing history archive (auto-pushes the previous date when next-date changes)
- Client contact card with one-tap **Call** + **WhatsApp** (pre-written professional reminder)
- Search across file / case / CNR / party / court · pre-fetched detail navigation
- Tenant-scoped by `partnerId` — every query auto-filtered, zero cross-leak

### 🧑‍⚖️ Hearing Track
- Today / Tomorrow / Pending tabs with live counts (IST-aware)
- One-tap **Call**, **WhatsApp** (pre-written professional reminder), **Open**
- Inline next-date update on the Pending tab → row exits the bucket on save

### 👥 Client Crew
- Client directory with phone, WhatsApp, email, address
- Auto-counts cases per client (by `clientId` or fallback name match)
- Call / WhatsApp / Email buttons baked into every card

### 🏛️ Court Hub
- Reusable court master — name, hall/court number, place
- Case-count badges roll up automatically
- 7 office defaults seeded on first visit

### 🪄 AI Assistant
- 12 professionally drafted prompt templates (Plaints, Written Statements, Affidavits, Sec 482 quashing, Bail under 437/439, Anticipatory bail under 438, Vakalatnama, Adjournment, Cross-exam plan, Notice + reply, Judgment summary)
- Editable per-partner library — every change persists to Mongo
- Curated research-tools deck (Indian Kanoon, SCC Online, Manupatra, ChatGPT, Claude)

### 🗂️ Work Flow — _Trello-grade canvas with live multiplayer_
- 🎨 **Full-bleed React Flow canvas** — lists are positionable nodes, cards drag freely between them, edges connect lists with editable labels
- ⚡ **Live updates within ~1 second** — when one user moves a card, everyone else watching the same board sees it pulse copper with a floating actor label: `Tejas · Junior · Civil — moved this card`
- 👁️ **Presence dock** — top bar shows a live avatar stack of who's currently on the board, hover to see role + designation
- ✨ **Optimistic UI** — cards and lists appear the moment you press Enter, with a pending state until the server confirms; rollback on failure
- 🎛️ **Designed canvas controls** — labelled bottom-left toolbar (Zoom · Fit · Lock · Map · Help) with keyboard shortcuts (`F` fit, `L` lock, `M` map, `+/−` zoom, `?` help)
- 🔔 **Bell drawer** — board-scoped activity feed + admin's delete-request inbox, all live
- 🌱 **7 office defaults** seeded on first visit (New Suits & Petitions, Notices, I.A.s / Petitions, C.A.s, Battas, Follow-ups, Instructions)
- 🎨 **7 colour presets** (forest · copper · sea · terracotta · ochre · plum · ink)

### 📜 Activity log
- Office-wide audit feed — every change in Work Flow, Cases, Clients, Courts, Prompts, Profile, and Users
- Click any row → modal with full metadata (changed fields, before/after, board context, deep-link to source)
- Filter pills per family (Cards / Lists / Boards / Cases / Clients / Courts / Prompts / People / Profile)
- Configurable retention (default 30 days; admin can set forever) with TTL-driven Mongo cleanup

### 🚫 Smart delete with admin approval
- All non-admins can do everything **except delete**
- Empty list/card created by you? Direct delete — no friction
- Anything with content? The system asks "why?" → admin sees it in the canvas bell + Activity / Requests tab → approves or rejects with optional note
- Existing pending requests are auto-marked obsolete when an admin direct-deletes the target
- Applies to lists, cards, boards, cases, prompts (boards always require admin)

### 🔐 Users / Advocates with **RBAC**
- 5 roles: **Admin · Advocate · Junior · Clerk · Viewer** with colour-coded pills
- Office admin can add staff (email + password + role + designation), reset passwords, deactivate, remove
- Server-enforced permissions, partner-scoped data, can't self-deactivate

### 📊 Dashboard
- Real-time tiles — Today · Tomorrow · Pending · Vault counts
- Today's board (cause-list)

### 🪪 My Profile
- 8 fields (name, phone, email-locked, state, country, bar enrolment, designation, office address)
- View / edit toggle with the same partner-side API used by mobile

---

## 🏗️ Stack

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 16 · App Router · Turbopack                       │
│  React 19 · TypeScript 5.9                                 │
│  Tailwind v4 (@theme blocks)                               │
│  Auth.js v5 (cookie + JWT for mobile)                      │
│  Mongoose 9.5 · MongoDB Atlas (Mumbai)                     │
│  @xyflow/react (canvas) · @dnd-kit (cards)                 │
│  Upstash Redis (optional — live-feed probe + rate limit)   │
└────────────────────────────────────────────────────────────┘
```

**Notable choices**
- 🔁 Same `/api/app/*` endpoints power both web and mobile via `requirePartner` (cookie OR JWT)
- 🗓️ Asia/Kolkata (IST) midnight math centralised in `src/lib/ist-day.ts`
- 🌱 Lazy seeding pattern — defaults (boards, prompt templates) seed per-partner on first visit
- 🎯 Next 16's `proxy.ts` (formerly `middleware.ts`)
- ⚡ Activity log is the realtime backbone — every mutation already writes there, so the audit log doubles as the live-update channel
- 🧪 Type-checked end-to-end, every endpoint tenant-scoped server-side

---

## ⚡ How live collaboration works

The trick: **every mutation already writes to the `Activity` collection**, so the audit log doubles as the realtime change feed. No WebSockets, no vendor lock-in.

```
            ┌──────────────────────────────────────────────────┐
            │              MongoDB Activity collection          │
            └────────────────────┬─────────────────────────────┘
                                 │ (poll, since=lastSeenId)
                                 ▼
            ┌──────────────────────────────────────────────────┐
            │   GET /api/app/activity/live?since=…&board=…      │
            │   Probes Upstash first (~95% cache hits skip Mongo)│
            └────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
            ┌──────────────────────────────────────────────────┐
            │             useBoardLiveFeed hook                 │
            │  • adaptive polling: 1s active → 30s background   │
            │  • BroadcastChannel for same-browser tab fan-out  │
            │  • localStorage persists last-seen id per board   │
            └──┬───────────┬───────────┬──────────────────────┘
               │           │           │
               ▼           ▼           ▼
           BellDrawer   Canvas      Activity Page
                        Highlights
```

**Adaptive polling cadence** — 1 s when the canvas is active, 3 s idle, 6 s deep idle, 30 s when backgrounded. Page Visibility API drives the gate.

**Coalescing** — bursts from the same actor on the same target type within 4 s are collapsed into one highlight, so bulk creates don't strobe.

**Cost** — designed to scale to ~500 concurrent canvas viewers on Vercel + the Upstash free tier. Past that, Upstash paid (~$10–30/month). Past ~1,500, swap polling for SSE inside the same hook.

**Upstash is optional** — if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` aren't set, the live feed falls through to direct Mongo queries and the rate limiter becomes a no-op. Local dev works untouched.

---

## 🚀 Getting started

### 1. Clone & install
```bash
git clone https://github.com/hyperzen1320/LegalEasy.git
cd LegalEasy
npm install
```

### 2. Environment
Create `.env.local` in the project root:
```bash
# Required
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/legaleasy
AUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=<another long secret for mobile JWT>

# Optional — speeds up the live feed at scale (>30 active partners)
# Free tier at upstash.com is plenty until then
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 3. Run
```bash
npm run dev
# → http://localhost:3000
```

### 4. First login
- Sign up at `/signup` (creates a partner office + admin user)
- Or run a seed script under `scripts/`

---

## 📂 Project structure

```
src/
├── app/
│   ├── (marketing)/         · Landing pages
│   ├── admin/               · Global-admin console
│   ├── app/                 · Partner office workspace
│   │   ├── activity/        · Audit log + delete-request review
│   │   ├── ai/              · AI Assistant + prompt CRUD
│   │   ├── cases/           · Case Vault list + detail + new
│   │   ├── clients/         · Client Crew
│   │   ├── courts/          · Court Hub
│   │   ├── hearings/        · Hearing Track (today/tmrw/pending)
│   │   ├── profile/         · My Profile
│   │   ├── users/           · Users / Advocates (RBAC)
│   │   ├── workflow/        · Work Flow canvas (live multiplayer)
│   │   └── components/      · Sidebar, Topbar, shared UI
│   ├── api/
│   │   ├── admin/*          · Global admin endpoints
│   │   ├── app/*            · Partner-side endpoints (cookie + JWT)
│   │   │   ├── activity/live· Live change feed (probe-then-query)
│   │   │   ├── delete-requests· Approval queue + count
│   │   │   └── boards/[id]/heartbeat· Presence beacon
│   │   └── mobile/*         · Mobile-only auth shims
│   └── layout.tsx
├── auth.ts                  · Auth.js v5 config
├── auth.config.ts           · Edge-safe authorize callback
├── proxy.ts                 · Next 16 routing proxy
├── lib/
│   ├── db.ts                · Mongo singleton
│   ├── partner-auth.ts      · requirePartner() → ctx with partnerId
│   ├── jwt.ts               · Mobile JWT verify/sign
│   ├── ist-day.ts           · IST midnight helper
│   ├── hearings-bucket.ts   · today/tmrw/pending shared logic
│   ├── activity.ts          · logActivity / logWorkflowActivity
│   ├── upstash.ts           · Redis client + rate limiter (optional)
│   ├── broadcast-channel.ts · Same-tab fan-out for mutations
│   ├── use-board-live-feed.ts  · Adaptive polling hook
│   ├── use-board-presence.ts   · Heartbeat + active-users hook
│   ├── use-optimistic-action.ts· Generic optimistic mutation
│   ├── delete-eligibility.ts   · Smart-delete rule helpers
│   ├── delete-target.ts        · Soft-delete dispatcher with cascades
│   ├── workflow-rbac.ts        · Per-action role gate
│   ├── prompt-defaults.ts      · 12 seeded legal prompts
│   └── board-defaults.ts       · 7 seeded boards + colour presets
└── models/
    ├── User.ts              · userType + role (RBAC) + profile fields
    ├── Partner.ts           · Office record + branding + subscription
    ├── Case.ts              · Case + embedded hearings[]
    ├── Client.ts            · Client directory
    ├── Court.ts             · Court master
    ├── PromptTemplate.ts    · AI prompt library
    ├── Board.ts             · Work Flow boards
    ├── BoardList.ts         · Canvas lists with positions
    ├── BoardEdge.ts         · Connections between lists
    ├── Task.ts              · Cards (with embedded checklists)
    ├── Activity.ts          · Audit log + realtime backbone
    ├── DeleteRequest.ts     · Admin approval queue
    ├── BoardPresence.ts     · "Who's on this board now" (TTL 60s)
    ├── Plan.ts              · Subscription plans
    └── AccessRequest.ts     · Office signup requests
```

---

## 🛡️ Tenancy & permissions

| | |
|---|---|
| 🏢 **Tenant scoping** | Every partner-side query filtered by `partnerId` from `requirePartner(request)` |
| 🔐 **Auth** | Auth.js cookie session (web) **OR** Bearer JWT (mobile) — same endpoint, same guard |
| 👮 **Roles** | `partner_admin` (auth scope) + `role` (RBAC: admin · advocate · junior · clerk · viewer) |
| ✍️ **Write permissions** | All five roles can perform every action **except delete** |
| 🗑️ **Delete permissions** | Admin direct-deletes anything · non-admins can direct-delete only empty lists/cards they created · everything else flows through the DeleteRequest queue with admin approval |
| 🚫 **Soft delete** | Every model has `isDeleted` — nothing is hard-removed |
| 📜 **Audit trail** | Every mutation writes to `Activity` with before/after diffs; doubles as the live feed |

---

## 🛣️ Roadmap

### Shipped
- [x] ⚖️ **Phase 1 MVP** — Cases · Clients · Courts · Hearings · AI · Profile · Users RBAC · Work Flow boards
- [x] 🗂️ **Phase 1.5** — Trello-grade canvas with positioned lists + edges + cards + checklists + drag/drop
- [x] 📜 **Phase 2.0** — Activity timeline UI + click-to-detail · cross-module audit log
- [x] 🚫 **Phase 2.1** — Smart-delete with admin approval queue · canvas bell drawer
- [x] ⚡ **Phase 2.2** — Live board sync · presence dock · optimistic UI · designed canvas controls

### Next up
- [ ] 🪶 **Senior Desk** — personal reminders + advocate-to-advocate internal messaging
- [ ] 🔔 **Notifications** — actionable alerts for hearings, pending dates, workflow due, requests
- [ ] 🔍 **Global search** — single search bar across cases / clients / courts / hearings
- [ ] 📄 **Hearing report export** — CSV / PDF download from Hearing Track filters
- [ ] 📊 **Dashboard widgets** — total active cases · unread notifications · per-advocate workload
- [ ] 🤝 **Inter-office user requests** — sent / received connection requests for cross-office collaboration

### Later
- [ ] 📱 Push notifications on mobile · iOS-first
- [ ] 📲 Mobile parity for live-feed canvas
- [ ] ⚠️ Conflict-resolution toast on simultaneous moves
- [ ] ✉️ Magic-link office invites

---

## 💌 The advocate's pact

> _All AI-generated drafts must be verified, edited and signed by an advocate before filing._

LegalEasy is a tool, never the lawyer. The judgement, the responsibility, the seal — those are yours.

---

<div align="center">

**Built for the Indian advocate.**
Designed in Chennai · Tested in chambers · Shipped from Mumbai

⚖️ _Justice deserves better tooling._

</div>
