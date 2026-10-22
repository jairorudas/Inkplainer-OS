# R2 gallery Worker

A small Cloudflare Worker that lets Inkplainer list, import, upload and delete images in a
**private** R2 bucket without putting any R2 credentials in the browser.

| Endpoint | Needs | What it does |
|---|---|---|
| `GET /list` | `API_TOKEN` | Lists images under `PREFIX` (the `.trash/` folder is hidden) |
| `GET /file?key=` | `API_TOKEN` | Returns one image |
| `PUT /file?key=` | `WRITE_TOKEN` | Uploads an image (max 20 MB, content is checked, no overwrite unless `&overwrite=1`) |
| `DELETE /file?key=` | `WRITE_TOKEN` | Moves the image to `<PREFIX>.trash/<timestamp>/…`; nothing is erased |

Safety notes
- Two tokens: the read token cannot upload or delete; the write token cannot read. If `WRITE_TOKEN` is not set the Worker is read-only.
- Every request needs `Authorization: Bearer <token>`; comparison is constant-time.
- CORS is limited to `ALLOWED_ORIGINS`; only `PREFIX` is reachable; only image files; `..`, `//`, and `.trash/` keys are refused.
- Deleted images stay in the bucket under `.trash/`; remove them from the Cloudflare dashboard when you are sure.

## Setup

1. Deploy: `npx wrangler deploy` in this folder (it binds the bucket as `ASSETS` and sets the variables from `wrangler.toml`).
2. Secrets (type each value yourself; keep them out of git):
   - `npx wrangler secret put API_TOKEN`
   - `npx wrangler secret put WRITE_TOKEN` (optional; enables upload/delete)
3. Variables in `wrangler.toml`: `PREFIX` (e.g. `production/`) and `ALLOWED_ORIGINS` (the app's origins).
4. In Inkplainer: Layers → **Import from R2**, enter the Worker URL and the token(s).

The tokens are stored in this browser only if you tick *Remember on this device*.
