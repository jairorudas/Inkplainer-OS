# R2 gallery Worker

A small Cloudflare Worker that lets Inkplainer list, import, upload and delete images in a
**private** R2 bucket without putting any R2 credentials in the browser.

| Endpoint | Needs | What it does |
|---|---|---|
| `GET /list` | `API_TOKEN` | Lists images under `PREFIX` (the `.trash/` folder is hidden). With `&delimiter=/` it lists only one level and returns the sub-folders as `folders` (used to browse project by project) |
| `GET /list?kind=audio` | `API_TOKEN` | Lists audio files under `AUDIO_PREFIX` (narration) |
| `GET /file?key=` | `API_TOKEN` | Returns one image, or one narration file under `AUDIO_PREFIX` |
| `PUT /file?key=` | `WRITE_TOKEN` | Uploads an image (max 20 MB, content is checked, no overwrite unless `&overwrite=1`) |
| `DELETE /file?key=` | `WRITE_TOKEN` | Moves the image to `<PREFIX>.trash/<timestamp>/…`, or a narration to `<AUDIO_PREFIX>.trash/<timestamp>/…`; nothing is erased |
| `POST /rename?from=&to=` | `WRITE_TOKEN` | Renames a narration inside `AUDIO_PREFIX` (same extension, never overwrites an existing file, `409` if the new name is taken) |

Safety notes
- Two tokens: the read token cannot upload or delete; the write token cannot read. If `WRITE_TOKEN` is not set the Worker is read-only.
- Every request needs `Authorization: Bearer <token>`; comparison is constant-time.
- `AUDIO_PREFIX` (e.g. `narration/`) can be listed and downloaded with the read token; with the write token its files can also be renamed and soft-deleted (to `<AUDIO_PREFIX>.trash/`). Audio upload is still not supported. **Redeploy the Worker (`npx wrangler deploy`) to get rename/delete for narrations; until then the app's Rename/Delete buttons answer with an error.**
- CORS is limited to `ALLOWED_ORIGINS`; only `PREFIX` is reachable; only image files; `..`, `//`, and `.trash/` keys are refused.
- **Redeploy the Worker to get project-folder browsing.** The app still works with an older Worker (it falls back to grouping the flat list by folder), but only the new one pages folder by folder.
- Deleted images stay in the bucket under `.trash/`; remove them from the Cloudflare dashboard when you are sure.

## Setup

1. Deploy: `npx wrangler deploy` in this folder (it binds the bucket as `ASSETS` and sets the variables from `wrangler.toml`).
2. Secrets (type each value yourself; keep them out of git):
   - `npx wrangler secret put API_TOKEN`
   - `npx wrangler secret put WRITE_TOKEN` (optional; enables upload/delete)
3. Variables in `wrangler.toml`: `PREFIX` (empty = the whole bucket, so every project folder at the root shows up; or e.g. `production/` to restrict the app to one folder), `AUDIO_PREFIX` (e.g. `narration/`, optional) and `ALLOWED_ORIGINS` (the app's origins).
4. In Inkplainer: Layers → **Import from R2**, enter the Worker URL and the token(s).

The tokens are stored in this browser only if you tick *Remember on this device*.
