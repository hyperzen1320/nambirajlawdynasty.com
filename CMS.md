# Website CMS (Supabase)

Every word, image, link and menu item on the public site is editable at **`/admin`**, and
news is published from there too. Content lives in Supabase project
**`pfogrnmvnuttgmuobkyh`**. Saving in the admin updates the live site immediately.

---

## 1. Connect the site to Supabase

Set these on the server (locally in `.env.local`, in Docker in `.env`):

```bash
SUPABASE_URL=https://pfogrnmvnuttgmuobkyh.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   # Project Settings → API Keys (the legacy anon key also works)
```

They are read at **runtime** on the server — deliberately not `NEXT_PUBLIC_*`, which Next
freezes at build time. The publishable key is safe to expose; row level security is what
protects the data. **No service-role key is needed anywhere.**

## 2. Create the database (one time)

In Supabase → **SQL Editor**, run these two files in order:

1. [`supabase/migrations/20260913000000_cms.sql`](supabase/migrations/20260913000000_cms.sql):
   tables, security rules, and the `cms-media` image bucket.
2. [`supabase/seed.sql`](supabase/seed.sql): loads the site's current copy.

Both are safe to re-run. The seed never overwrites a document that already exists.

## 3. Add an editor

Signing in is not enough to edit; the account must also be on the editor list.

1. Supabase → **Authentication → Users → Add user → Create new user**. Enter the email and
   a password, and tick *Auto Confirm User*.
2. SQL Editor:

   ```sql
   insert into public.cms_admins (user_id, email)
   select id, email from auth.users where email = 'editor@example.com'
   on conflict (user_id) do nothing;
   ```

To remove an editor: `delete from public.cms_admins where email = 'editor@example.com';`

Recommended: **Authentication → Sign In / Providers → turn off “Allow new users to sign
up”**, so accounts only exist when you create them.

## 4. Use it

Open `/admin`, sign in, and pick what to edit:

| In the admin | Controls |
| --- | --- |
| **News posts** | Write, publish/unpublish and delete articles for `/news` |
| **Site settings** | Logo & wordmark, menu (including dropdowns), address, phones, email, WhatsApp, social links, footer, default SEO |
| **Home / About / Practicing Area / Services / Our Team / Contact / News page** | All copy, images, lists (team members, service cards, practice areas…) and each page's SEO title & description |
| **Disclaimer popup** | The Bar Council notice, its buttons, and whether it's shown at all |

- **Lists**: add, reorder (↑ ↓) and remove items. Numbered sections (Services, Practicing
  Area) renumber themselves.
- **Images**: *Upload image* stores the file in Supabase Storage (JPEG/PNG/WebP/AVIF/GIF,
  max 10 MB).
- **Rich text** (paragraph fields marked so): a blank line starts a new paragraph,
  `**bold**`, `*italic*`.
- **History**: every save keeps the previous version (last 50). *History → Restore* puts
  one back.
- **Two editors at once**: if someone saved the same page after you opened it, your save
  is refused rather than silently overwriting theirs.
- **News**: a post is visible to everyone once *Published* is on. Drafts are only visible
  in the admin. The web address is made from the headline unless you set one.
- **Ctrl/⌘ + S** saves.

---

## How it works

```
Visitor ─▶ page (prerendered) ─▶ getDocument("home")  "use cache" + cacheTag("cms:home")
                                         │
                                         ▼
                              Supabase  cms_documents  (public read via RLS)

Editor  ─▶ /admin ─▶ saveDocument()  (server action, signed-in user, RLS: cms_admins only)
                         └─▶ updateTag("cms:home")  → next visitor gets the new content
```

- **Content model**: [`src/cms/documents.ts`](src/cms/documents.ts) defines every editable
  document: its fields, which drive the TypeScript types, the admin form and validation,
  plus default content. To make something new editable, add a field there, use it in the
  page, and run `npm run cms:seed-sql` to regenerate the seed.
- **News** is a table (`news_posts`) instead of a document, since it keeps growing. See
  [`src/cms/news-fields.ts`](src/cms/news-fields.ts) and [`src/cms/news.ts`](src/cms/news.ts).
- **Never blank**: if Supabase isn't configured or can't be reached, pages render the
  built-in copy from `documents.ts` and retry within a minute.
- **Caching**: pages stay static. A save expires only that document's cache tag. Changes
  made directly in Supabase Studio (bypassing the admin) show up within an hour.
- **Security**: `src/proxy.ts` refreshes the session and turns signed-out visitors away
  from `/admin`. Every server action re-checks the editor, and Postgres row level security
  enforces the same rule on every write. Uploaded SVGs are refused.

### Docker note

`.env` isn't part of the image build, so `next build` inside Docker prerenders with the
built-in copy. The running container, which does have `.env`, replaces it with Supabase
content within about a minute of the first visit. To have real content from the very
first request, pass both variables as build args to the builder stage.
