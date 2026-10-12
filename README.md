# IB Meme Hub

**Because the IB wasn't painful enough.** An independent, anonymous IB student meme community. Plain HTML, CSS, and JavaScript; Supabase database and image storage; **Netlify hosting connected to GitHub**. No npm, framework, server, build command, registration, or login.

## Run or preview

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the local site in your browser. Use an HTTP server rather than opening `index.html` as a file because the app uses ES modules. Unconfigured Supabase automatically shows six original, clearly marked demo memes. Demo likes/reports are local to this browser; downloads and sharing work; uploads explicitly do not submit. Configuring both Supabase values automatically replaces demos with real database content. A configured connection error never silently switches back to fake content.

## Connect Supabase

1. Create a **new Supabase project** at [supabase.com](https://supabase.com). A fresh project avoids conflicts with existing application policies. No user-auth setup is needed; the app makes requests with the public API key and never signs users in.
2. Open **SQL Editor → New query**.
3. Paste all of [`supabase-setup.sql`](./supabase-setup.sql) and run it. This creates the table, constraints, indexes, RLS, safe counter RPCs, public bucket, and upload policy in one transaction. Re-running is supported for this schema. It deliberately fails if unrelated permissive policies could undermine security; review the error rather than removing other application policies blindly.
4. Go to **Storage → memes → Configuration**. SQL normally creates the bucket. If your dashboard requires manual creation, first create a bucket named `memes`, set **Public**, then re-run the SQL. Confirm maximum file size **10 MB / 10,485,760 bytes** and MIME types `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
5. Under **Storage → Policies**, verify `memes_anonymous_upload` allows only INSERT into `memes` with filenames matching `uploads/<uuid>.<jpg|png|webp|gif>`. The script creates it. Do not add UPDATE, DELETE, ALL, or overwrite policies. Do not enable `upsert` in the app.
6. Find your **Project URL** and **publishable key** in the project Connect dialog or **Settings → API / API Keys** (a legacy public `anon` key also works).
7. Edit [`js/config.js`](./js/config.js) with exactly these **two public values**:

   ```js
   const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY";
   ```

   The browser must receive this public key. It is intentionally safe to expose **when the SQL permissions and RLS are configured correctly**. **Never put a secret key, service_role key, database password, or Netlify token in these files.** The client rejects known secret/service-role key formats, but this cannot undo a credential leak. Rotate any accidentally exposed secret immediately.
8. Commit and push the site and the public configuration to GitHub. If publishing this prepared branch, for example:

   ```sh
   git add index.html 404.html .nojekyll README.md netlify.toml supabase-setup.sql css js assets tests
   git commit -m "Build IB Meme Hub with moderated Supabase uploads"
   git push -u origin work
   ```

   Alternatively merge the finished branch into `main` and deploy that branch. The existing `Atharv/` site is preserved; IB Meme Hub lives at the root.

## Deploy to Netlify using GitHub

1. Sign in to [Netlify](https://app.netlify.com) and choose **Add new project → Import an existing project** (some accounts call this **Add new site → Import an existing project**).
2. Select **GitHub**, authorize access to this repository, and select **Atharv715/lol**.
3. Select the branch containing the new site (`work` if pushed using the commands above, or `main` after merging).
4. Leave **Base directory** and **Build command** empty. Set **Publish directory** to `.`. The committed `netlify.toml` also declares this; no build step or Netlify environment variables are necessary.
5. Choose **Deploy**. Netlify provides the actual `https://…netlify.app` URL. Future pushes to the selected branch redeploy automatically. Set a custom domain under **Domain management** if desired.
6. Visit the deployed page. In demo mode, verify search, category filters, Random, modal, theme, download, and mobile navigation. After configuring Supabase, submit one image and verify it remains absent until approval. See the checks below.

Netlify headers restrict scripts to this site and jsDelivr, and images/network calls to Supabase. If you use a **custom Supabase domain**, add that exact HTTPS host to the CSP `img-src` and `connect-src` entries in `netlify.toml` and adapt the URL constraint in SQL; do not loosen it to `*`. Project URLs in the standard `*.supabase.co` format work as shipped.

## Optional GitHub Pages hosting

This site also works at `https://USERNAME.github.io/REPOSITORY/`:

1. Push or merge the site into `main`.
2. In GitHub, open **Settings → Pages**.
3. Source: **Deploy from a branch**. Branch: **main**, Folder: **/ (root)**. Save.
4. Wait for the Pages deployment and use GitHub’s reported URL, normally `https://Atharv715.github.io/lol/`.

All app assets use relative URLs; `.nojekyll` is included. Netlify headers are specific to Netlify and are not applied by GitHub Pages. The page itself has no need for a client-side router or catch-all rewrite.

## Moderate submissions

**Supabase Dashboard → Table Editor → memes → filter status = pending**. Inspect the title, tags, display name, and image. Change `status` to `approved` to publish it, or `rejected` to keep it out of the feed. The site loads only approved rows. Check `reports` regularly; reports flag a meme but do not automatically remove it.

To remove inappropriate content, use the **owner dashboard**, delete its Storage object (the `storage_path` identifies it), and delete its row. Rejected images remain public until you delete them. If image upload succeeds but record insertion fails, the owner must remove the orphan object; anonymous clients deliberately cannot delete files to clean up errors. There is no public admin page.

## Features and implementation

- Responsive original dark design, optional persistent light theme, compact mobile navigation, visible keyboard focus, native focus-trapped dialogs, Escape and backdrop dismissal, live status messages, reduced-motion support.
- Six original local SVG demo memes; remote visitor uploads support JPEG, PNG, WEBP, GIF only, never SVG.
- Instant title/category/tag search; 26 categories; trending score `(likes × 2 + downloads × 3 + 5) / (ageInHours + 4)^0.65`; newest and unbiased Fisher–Yates random order; Random Meme view; paginated database reads and incremental card rendering.
- Full meme view, lazy images with reserved space, loading skeletons, empty/search/error states, native sharing/clipboard fallback, stable `?meme=<id>` share links.
- Browser-local duplicate-like/report prevention; RPC-only counter updates; actual Blob downloads with sanitized filenames and an image-link fallback.
- Anonymous submissions with preview, drag/drop, MIME/type-signature and 10 MB validation, length-limited text, safe UUID paths, loading states, pending approval, and precise partial-upload errors.
- All user content is rendered with safe DOM/text APIs. Stored image URLs must match the configured Supabase origin and public bucket path. No arbitrary HTML or remote image URLs are rendered.

## Verify before public use

Frontend smoke tests require the available Playwright development tool; visitors and deployment do not:

```sh
node tests/browser.cjs
```

The test starts its own temporary local server. It verifies demo interactions, mobile overflow/navigation, subdirectory asset paths, configured backend behavior through mocked REST endpoints, pending-only uploads, and connection errors. Mock tests do **not** prove permissions in your Supabase project.

After running the SQL in the actual project, check from the browser/API with the public key:

1. Pending/rejected rows are not readable; approved rows are.
2. A submission with default fields creates a pending row with zero counters; attempts to insert `status: approved`, nonzero counters, or a custom timestamp fail.
3. Direct UPDATE/DELETE requests fail or affect zero rows; they must never mutate a row.
4. The three RPCs increment only their own counters on approved rows; pending IDs return null and do not change.
5. A valid fresh UUID image upload succeeds; overwriting (`upsert: true`), deleting, oversized images, and disallowed MIME types fail.
6. Approval through the owner dashboard makes the meme appear on refresh. A known share URL opens the approved meme. Images download successfully.

## Limits of anonymous uploads

This is a community site, not an abuse-proof upload platform. localStorage is UI convenience; anyone can reset it or call the RPCs directly. Uploads and RPCs have no per-person rate limits, CAPTCHA, or identity checks, so attackers can spam submissions/counters and consume storage/bandwidth. Add platform limits and monitor usage before inviting a large audience. Restrict API privileges and never bypass RLS.

**The requested bucket is public, so pending and rejected image URLs are accessible if known, even though their database rows are private.** Manual feed approval does not provide private image quarantine. For strict pre-publication privacy, a private staging bucket plus a trusted backend moderation pipeline is required; that is beyond this entirely static, anonymous architecture. MIME checks and signatures catch simple mismatches, not malware, inappropriate content, or copyright violations. Review manually, remove rejected/orphan images, and establish community rules.

IB Meme Hub is an independent student community and is not affiliated with, endorsed by, or associated with the International Baccalaureate Organization.
