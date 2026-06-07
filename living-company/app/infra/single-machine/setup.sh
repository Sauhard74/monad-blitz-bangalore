#!/usr/bin/env bash
#
# One-machine setup for the Living Company stack (Paperclip + web app).
# Generates secrets into a chmod-600 .env (never printed), clones a PINNED
# Paperclip, and brings the stack up with Docker Compose.
#
# Usage:
#   cd infra/single-machine
#   cp .env.example .env        # fill AZURE_AI_* (and PAPERCLIP_REF to pin)
#   ./setup.sh
#
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "ERROR: Docker not installed/running."; exit 1; }
docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon not reachable."; exit 1; }

[ -f .env ] || { echo "ERROR: .env not found. Run: cp .env.example .env  (then edit)"; exit 1; }
chmod 600 .env

# shellcheck disable=SC1091
set -a; source .env; set +a
: "${PAPERCLIP_REF:=master}"
: "${PAPERCLIP_SRC:=./.paperclip-src}"

# --- Generate secrets only if absent; write back to .env WITHOUT echoing -----
upsert() { # key value -> set/replace KEY=value in .env
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    # portable in-place edit
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' .env > .env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}
[ -n "${BETTER_AUTH_SECRET:-}" ] || { upsert BETTER_AUTH_SECRET "$(openssl rand -hex 32)"; echo "generated BETTER_AUTH_SECRET"; }
[ -n "${PAPERCLIP_SECRETS_MASTER_KEY:-}" ] || { upsert PAPERCLIP_SECRETS_MASTER_KEY "$(openssl rand -hex 32)"; echo "generated PAPERCLIP_SECRETS_MASTER_KEY"; }
chmod 600 .env

# --- Clone Paperclip pinned to PAPERCLIP_REF --------------------------------
if [ ! -d "$PAPERCLIP_SRC/.git" ]; then
  echo "cloning paperclip @ ${PAPERCLIP_REF} -> ${PAPERCLIP_SRC}"
  git clone --depth 1 --branch "$PAPERCLIP_REF" https://github.com/paperclipai/paperclip.git "$PAPERCLIP_SRC" \
    || git clone "https://github.com/paperclipai/paperclip.git" "$PAPERCLIP_SRC"
fi
( cd "$PAPERCLIP_SRC" && git fetch --depth 1 origin "$PAPERCLIP_REF" 2>/dev/null && git checkout -q "$PAPERCLIP_REF" 2>/dev/null ) || true
echo "paperclip at commit: $(git -C "$PAPERCLIP_SRC" rev-parse --short HEAD)"

# --- Build + run ------------------------------------------------------------
echo "building and starting the stack…"
docker compose up -d --build

cat <<EOF

============================================================
✅ Stack is up.

  Web (office):       http://localhost        (port 80)
  Paperclip dash:     http://localhost:3100   (loopback only; tunnel for remote)

Next:
  1. Open the Paperclip dashboard, sign up, complete the one-time board-claim:
       docker compose logs paperclip | grep board-claim
  2. Create a company + agents (CEO, Engineer, Designer, Marketer, PM).
  3. Create an agent API key; put it in .env as PAPERCLIP_API_KEY, set
     PAPERCLIP_COMPANY_ID and NEXT_PUBLIC_DATA_SOURCE=paperclip, then:
       docker compose up -d
  (Secrets are in .env — chmod 600, never printed. Keep that file safe.)
============================================================
EOF
