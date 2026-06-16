# Deploy to Vercel

## What is deployed

- `/` → Landing page (`index.html`) with links to both tools
- `/script-analyser` → Script analyser tool
- `/title-thumbnail-tool` → Title & thumbnail lab
- `/api/chat` → Secure serverless Anthropic proxy
- `/api/health` → Health check

## 1) Push project to GitHub

Commit and push this folder to a GitHub repository.

## 2) Import in Vercel

1. Go to [Vercel](https://vercel.com/).
2. Click **Add New Project**.
3. Import your GitHub repo.
4. Framework preset can stay **Other**.

## 3) Add environment variable

In Vercel project settings:

- **Name:** `ANTHROPIC_API_KEY`
- **Value:** your Anthropic key

Redeploy after setting it.

## 3b) Enable Supabase cloud save (optional but recommended)

1. Create a Supabase project.
2. Run SQL in `SUPABASE_SETUP.sql` (SQL Editor).
3. Add these Vercel env vars:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy.

When enabled, both tools support cloud-backed **Save & Continue Later** across devices.

## 3c) Email + password login flow

- Open `/` and use the auth box.
- Sign in with your existing Supabase email/password user.
- The access token is stored in browser localStorage and used by both tools for cloud save.

## 4) Test routes

- `https://your-domain.vercel.app/`
- `https://your-domain.vercel.app/script-analyser`
- `https://your-domain.vercel.app/title-thumbnail-tool`
- `https://your-domain.vercel.app/api/health` (should show `hasApiKey: true`)
- `https://your-domain.vercel.app/api/health` (should show `hasApiKey: true`, and `hasSupabase: true` if enabled)

## Notes

- Never expose the API key in frontend JavaScript.
- Both tools already call `/api/chat` (server-side key usage).
