#!/usr/bin/env bash
# Installs a local git pre-push hook: pushing main also publishes it to Cloudflare Pages (tools/deploy.sh).
# A failed deploy only warns, it never blocks the push. Needs PAGES_PROJECT in your environment (or in .git/pages-project).
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
hook="$(git rev-parse --git-path hooks/pre-push)"
cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
# installed by tools/install-deploy-hook.sh
root="$(git rev-parse --show-toplevel)"
while read -r local_ref local_sha remote_ref remote_sha; do
  [ "$remote_ref" = "refs/heads/main" ] || continue
  [ "$local_sha" != "0000000000000000000000000000000000000000" ] || continue
  export PAGES_PROJECT="${PAGES_PROJECT:-$(cat "$(git rev-parse --git-dir)/pages-project" 2>/dev/null)}"
  "$root/tools/deploy.sh" "$local_sha" || echo "pre-push: the deploy failed; the push goes on anyway" >&2
done
exit 0
HOOK
chmod +x "$hook" "$root/tools/deploy.sh"
echo "installed $hook"
echo "tell it the project once:  echo <pages-project-name> > \"\$(git rev-parse --git-dir)/pages-project\""
