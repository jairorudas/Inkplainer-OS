# R2 gallery Worker

A small Cloudflare Worker that lets Inkplainer list and import images from a **private** R2
bucket without putting any R2 credentials in the browser.

- Read-only: the code only calls `list` and `get` on the bucket.
- Every request needs `Authorization: Bearer <API_TOKEN>`.
- CORS is limited to `ALLOWED_ORIGINS`; only `PREFIX` is visible; only image files are served.

## Setup

1. Create the Worker (dashboard: Workers & Pages → Create, or `npx wrangler deploy` in this folder).
2. Bind the bucket as `ASSETS` (Settings → Bindings → R2 bucket).
3. Variables: `PREFIX` (e.g. `production/`) and `ALLOWED_ORIGINS` (the app's origin, e.g. `http://localhost:8123,https://inkdesign.netlify.app`).
4. Secret: `API_TOKEN` (any long random string; keep it out of git).
5. In Inkplainer: Layers → **Import from R2**, enter the Worker URL and the token.

The token is stored in this browser only if you tick *Remember on this device*.
