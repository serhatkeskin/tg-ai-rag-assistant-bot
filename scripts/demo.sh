#!/usr/bin/env bash
#
# Operate this demo: status, deploy, stop/start, access tokens, the on-demand
# Telegram bot and the admin key. Called by the Makefile (`make help`); every
# subcommand also runs on its own:
#
#   scripts/demo.sh <command> [args]
#
# Project settings come from the environment the Makefile exports (SLUG,
# SERVICE, PAGES_PROJECT, FRONTEND_DIR, ...). Platform settings come from
# demo-maker itself (scripts/lib.sh + ~/.config/demo-maker/config.env), so this
# file never repeats account ids.
#
# Destructive commands refuse to run unless YES=1 is set; `make <target>
# INTERACTIVE=1` asks for it instead.
set -euo pipefail

DEMO_MAKER="${DEMO_MAKER:-$HOME/dotfiles/ai-tools/skills/demo-maker}"
[[ -f "$DEMO_MAKER/scripts/lib.sh" ]] || { echo "demo-maker not found at $DEMO_MAKER (set DEMO_MAKER)" >&2; exit 1; }
# shellcheck source=/dev/null
source "$DEMO_MAKER/scripts/lib.sh"
load_config

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${SLUG:?SLUG is required}"
DOMAIN_KIND="${DOMAIN_KIND:-personal}"
SERVICE="${SERVICE:-rag-api}"
PAGES_PROJECT="${PAGES_PROJECT:-rag-explorer}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FRONTEND_OUT="${FRONTEND_OUT:-$FRONTEND_DIR/out}"
HEALTH_PATH="${HEALTH_PATH:-/api/health/}"
PROTECTED_PATH="${PROTECTED_PATH:-/api/me/}"

HOST="$SLUG.$(domain_for "$DOMAIN_KIND")"
URL="https://$HOST"
RW=(-p "$RAILWAY_PROJECT_ID" -e "$RAILWAY_ENVIRONMENT_ID" -s "$SERVICE")

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()   { printf '  \033[31m✗\033[0m %s\n' "$*"; }
note()  { printf '  %s\n' "$*"; }
show()  { printf '>> %s\n' "$*" >&2; }

confirm() {
  [[ "${YES:-}" == "1" ]] && return 0
  echo "refusing: '$1' changes the live demo. Rerun with YES=1, or with INTERACTIVE=1 to be asked." >&2
  exit 64
}

# --------------------------------------------------------------------- lookups

backend_url() {
  if [[ -n "${BACKEND_URL:-}" ]]; then printf '%s' "$BACKEND_URL"; return; fi
  local host
  host="$(railway variable list "${RW[@]}" --json 2>/dev/null | jq -r '.RAILWAY_PUBLIC_DOMAIN // empty')"
  [[ -n "$host" ]] || die "no Railway domain for $SERVICE (set BACKEND_URL)"
  printf 'https://%s' "$host"
}

# Admin key for the admin API: $ADMIN_KEY, then pass, then the Railway variable.
admin_key() {
  if [[ -n "${ADMIN_KEY:-}" ]]; then printf '%s' "$ADMIN_KEY"; return; fi
  local key=""
  if pass_available; then
    key="$(pass show "$PASS_PREFIX/$SLUG/admin-key" 2>/dev/null | head -n1 || true)"
  fi
  if [[ -z "$key" ]]; then
    key="$(railway variable list "${RW[@]}" --json 2>/dev/null | jq -r '.ADMIN_KEY // empty' || true)"
  fi
  [[ -n "$key" ]] || die "admin key not found: set ADMIN_KEY, store it in pass ($PASS_PREFIX/$SLUG/admin-key) or on Railway"
  printf '%s' "$key"
}

admin_key_source() {
  if [[ -n "${ADMIN_KEY:-}" ]]; then echo "environment (ADMIN_KEY)"
  elif pass_available && pass show "$PASS_PREFIX/$SLUG/admin-key" >/dev/null 2>&1; then echo "pass ($PASS_PREFIX/$SLUG/admin-key)"
  else echo "Railway variable ADMIN_KEY on $SERVICE"
  fi
}

# admin_api METHOD PATH [JSON] -> response body; dies with the status on failure.
# The API accepts X-Admin-Key on every route, so the bot endpoints use it too.
admin_api() {
  local method="$1" path="$2" body="${3:-}" out code
  out="$(mktemp)"
  local -a args=(-sS -o "$out" -w '%{http_code}' -X "$method" -H "X-Admin-Key: $(admin_key)" -H "Content-Type: application/json" -m 60)
  [[ -n "$body" ]] && args+=(-d "$body")
  code="$(curl "${args[@]}" "$URL/api$path" || echo 000)"
  if [[ ! "$code" =~ ^2 ]]; then
    echo "admin API $method $path -> HTTP $code: $(head -c 300 "$out")" >&2
    rm -f "$out"
    [[ "$code" =~ ^(502|503)$ ]] && echo "(the backend is down or waking up: make start, or retry)" >&2
    exit 1
  fi
  cat "$out"; rm -f "$out"
}

# ---------------------------------------------------------------------- status

cmd_info() {
  bold "$SLUG"
  note "demo URL      $URL"
  note "admin panel   $URL/secret-admin"
  note "bot page      $URL/bot"
  note "frontend      Cloudflare Pages $PAGES_PROJECT (account $CLOUDFLARE_ACCOUNT_ID)"
  note "backend       Railway service $SERVICE (project $RAILWAY_PROJECT_ID)"
  note "CI pipeline   main-portfolio .github/workflows/deploy-tg-ai-rag-assistant-bot.yml"
  note "demo-maker    $DEMO_MAKER"
}

cmd_status() {
  bold "Frontend  $URL  (Pages $PAGES_PROJECT)"
  local headers code
  headers="$(curl -sI -m 30 "$URL/" || true)"
  code="$(awk 'NR==1{print $2}' <<<"$headers")"
  [[ "$code" =~ ^2 ]] && ok "HTTP $code" || bad "HTTP ${code:-no answer}"
  local last
  last="$(wrangler pages deployment list --project-name "$PAGES_PROJECT" --json 2>/dev/null \
    | jq -r 'if length > 0 then .[0] | "\(.Status)  \(.Environment) \(.Branch)  commit \(.Source)" else empty end' || true)"
  [[ -n "$last" ]] && note "last deploy   $last" || note "last deploy   unknown (wrangler not logged in?)"

  echo
  bold "Backend  $SERVICE  (Railway)"
  local svc
  svc="$(railway service status "${RW[@]}" --json 2>/dev/null || true)"
  if [[ -z "$svc" ]]; then
    bad "service not found"
  else
    local state
    state="$(jq -r '.status // "unknown"' <<<"$svc")"
    case "$state" in
      SUCCESS|SLEEPING) ok "deployment $state$( [[ "$state" == SLEEPING ]] && echo ' (app sleeping: wakes on the next request)')" ;;
      *) bad "deployment $state" ;;
    esac
    railway deployment list "${RW[@]}" --json 2>/dev/null \
      | jq -r '.[0:3][] | "  \(.createdAt[0:16] | sub("T"; " "))  \(.status)  \(.id[0:8])"' || true
    local health
    health="$(curl -s -m 60 -o /dev/null -w '%{http_code}' "$URL${HEALTH_PATH}" || echo 000)"
    [[ "$health" == "200" ]] && ok "health via edge $HEALTH_PATH -> 200" || bad "health via edge $HEALTH_PATH -> $health"
    local limits="${MAIN_PORTFOLIO_DIR:-}/scripts/apply-railway-limits.sh"
    if [[ -x "$limits" ]]; then
      "$limits" --check portfolio 2>/dev/null | grep -E "/$SERVICE( |$)" | sed 's/^/  /' || note "cap: not listed by apply-railway-limits --check"
    fi
  fi

  echo
  bold "Telegram bot"
  cmd_bot_status 2>/dev/null || note "bot status unavailable (backend asleep or no admin key)"

  echo
  bold "Access"
  local tokens
  if tokens="$(admin_api GET /admin/tokens/ 2>/dev/null)"; then
    jq -r --arg now "$(date -u +%Y-%m-%dT%H:%M:%S)" '
      [.[] | select(.is_active and (.expires_at[0:19] > $now))] as $a
      | "  \($a | length) active token(s), \(length) total"' <<<"$tokens"
  else
    note "token list unavailable (backend asleep or no admin key)"
  fi
}

cmd_logs() {
  local lines="${LOG_LINES:-100}"
  show "railway logs ${RW[*]} --lines $lines"
  railway logs "${RW[@]}" --lines "$lines"
}

# ---------------------------------------------------------------------- deploy

cmd_build() {
  show "(cd $FRONTEND_DIR && npm ci && npm run build)"
  (
    cd "$REPO/$FRONTEND_DIR"
    [[ -d node_modules ]] || npm ci --no-audit --no-fund
    npm run build
  )
  [[ -f "$REPO/$FRONTEND_OUT/index.html" ]] || die "$FRONTEND_OUT/index.html missing after the build"
}

# Same steps as the main-portfolio workflow: enforce the cap, then railway up
# from the repo root (one container runs the API and the Telegram bot).
cmd_deploy_backend() {
  local limits="${MAIN_PORTFOLIO_DIR:-}/scripts/apply-railway-limits.sh"
  if [[ -x "$limits" ]]; then
    show "$limits portfolio"
    "$limits" portfolio
  else
    die "apply-railway-limits.sh not found (set MAIN_PORTFOLIO_DIR); refusing to deploy without the resource cap"
  fi
  show "railway up --ci ${RW[*]}"
  (cd "$REPO" && railway up --ci "${RW[@]}" -m "manual deploy $(git rev-parse --short HEAD 2>/dev/null || echo local)")
  info "waiting for $URL$HEALTH_PATH"
  wait_http "$URL$HEALTH_PATH" 600 || die "backend did not become healthy"
  ok "backend healthy"
}

cmd_deploy_frontend() {
  [[ -f "$REPO/$FRONTEND_OUT/index.html" && "${SKIP_BUILD:-}" == "1" ]] || cmd_build
  # Run from the frontend dir so the Pages Function in functions/ is uploaded too.
  show "(cd $FRONTEND_DIR && wrangler pages deploy out --project-name $PAGES_PROJECT --branch main)"
  (cd "$REPO/$FRONTEND_DIR" && wrangler pages deploy "${FRONTEND_OUT#"$FRONTEND_DIR"/}" \
    --project-name "$PAGES_PROJECT" --branch main --commit-dirty=true)
}

cmd_deploy() {
  cmd_deploy_backend
  cmd_deploy_frontend
}

cmd_redeploy() {
  show "railway redeploy -y ${RW[*]}"
  railway redeploy -y "${RW[@]}"
}

# ------------------------------------------------------------------ stop/start

cmd_stop() {
  confirm stop
  bold "Removing the active backend deployment (database and variables stay)"
  show "railway down -y ${RW[*]}"
  railway down -y "${RW[@]}"
  ok "backend stopped; the frontend stays up and API calls answer 5xx"
  note "bring it back with: make start"
}

cmd_start() {
  bold "Starting the backend"
  show "railway redeploy -y ${RW[*]}"
  if ! railway redeploy -y "${RW[@]}"; then
    note "redeploy failed; rebuilding from source instead"
    cmd_deploy_backend
    return
  fi
  info "waiting for $URL$HEALTH_PATH"
  wait_http "$URL$HEALTH_PATH" 600 || die "backend did not become healthy"
  ok "backend healthy, $URL is live"
}

# -------------------------------------------------------------------- verify

cmd_verify() {
  local fail=0 code
  bold "Verifying $URL"
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$URL/")"
  [[ "$code" == "200" ]] && ok "frontend 200" || { bad "frontend $code"; fail=1; }
  code="$(curl -s -m 90 -o /dev/null -w '%{http_code}' "$URL$HEALTH_PATH")"
  [[ "$code" == "200" ]] && ok "health 200" || { bad "health $code"; fail=1; }
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$URL$PROTECTED_PATH")"
  [[ "$code" == "401" ]] && ok "no token -> 401" || { bad "no token -> $code (want 401)"; fail=1; }
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' -H 'X-Admin-Key: wrong' "$URL/api/admin/tokens/")"
  [[ "$code" == "403" ]] && ok "wrong admin key -> 403" || { bad "wrong admin key -> $code (want 403)"; fail=1; }

  # Full round trip: mint a token, call a protected path, revoke, call again.
  local created token id
  created="$(admin_api POST /admin/tokens/ '{"label": "verify", "days": 1}')"
  token="$(jq -r .token <<<"$created")"; id="$(jq -r .id <<<"$created")"
  code="$(curl -s -m 60 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$URL$PROTECTED_PATH")"
  [[ "$code" == "200" ]] && ok "fresh token -> 200" || { bad "fresh token -> $code"; fail=1; }
  admin_api DELETE "/admin/tokens/$id/" >/dev/null
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$URL$PROTECTED_PATH")"
  [[ "$code" == "401" ]] && ok "revoked token -> 401" || { bad "revoked token -> $code"; fail=1; }

  [[ $fail -eq 0 ]] && bold "all checks passed" || { bold "some checks failed"; exit 1; }
}

# -------------------------------------------------------------------- tokens

cmd_tokens() {
  admin_api GET /admin/tokens/ | jq -r --arg now "$(date -u +%Y-%m-%dT%H:%M:%S)" '
    ["ID", "STATE", "EXPIRES", "USAGE", "LABEL"],
    (.[] | [
      (.id | tostring),
      (if (.is_active | not) then "revoked"
       elif (.expires_at[0:19] <= $now) then "expired"
       elif (.usage_limit != null and .usage_count >= .usage_limit) then "used up"
       else "active" end),
      .expires_at[0:10],
      "\(.usage_count)/\(.usage_limit // "∞")",
      .label
    ]) | @tsv' | column -t -s $'\t'
}

# Machine-readable list for the INTERACTIVE token menu: id<TAB>label (state).
cmd_tokens_tsv() {
  admin_api GET /admin/tokens/ 2>/dev/null | jq -r --arg now "$(date -u +%Y-%m-%dT%H:%M:%S)" '
    .[] | "\(.id)\t\(.label) (\(if (.is_active | not) then "revoked"
      elif (.expires_at[0:19] <= $now) then "expired"
      else "active until \(.expires_at[0:10])" end))"' || true
}

cmd_token_create() {
  [[ -n "${LABEL:-}" ]] || die "LABEL is required: make token-create LABEL=acme DAYS=7"
  local payload created token
  payload="$(jq -nc --arg l "$LABEL" --argjson d "${DAYS:-7}" --arg u "${LIMIT:-}" \
    '{label: $l, days: $d} + (if $u == "" then {} else {usage_limit: ($u | tonumber)} end)')"
  created="$(admin_api POST /admin/tokens/ "$payload")"
  token="$(jq -r .token <<<"$created")"
  ok "token '$(jq -r .label <<<"$created")' (id $(jq -r .id <<<"$created")), valid until $(jq -r '.expires_at[0:10]' <<<"$created")$(jq -r 'if .usage_limit then ", \(.usage_limit) queries" else "" end' <<<"$created")"
  echo
  echo "  link:   $URL/"
  echo "  token:  $token"
  echo
  note "the viewer pastes the token on the login screen; list tokens again with: make tokens"
  if [[ "${COPY:-}" == "1" ]] && command -v pbcopy >/dev/null; then
    printf '%s\nToken: %s\n' "$URL/" "$token" | pbcopy && note "invitation copied to the clipboard"
  fi
}

need_id() { [[ -n "${ID:-}" ]] || die "ID is required: make $1 ID=<token id>  (list them with: make tokens)"; }

cmd_token_revoke() {
  need_id token-revoke; confirm token-revoke
  admin_api DELETE "/admin/tokens/$ID/" | jq -r '"  revoked token \(.id)"'
}

cmd_token_revoke_all() {
  confirm token-revoke-all
  local ids id
  ids="$(admin_api GET /admin/tokens/ | jq -r '.[] | select(.is_active) | .id')"
  [[ -n "$ids" ]] || { note "no active tokens"; return; }
  for id in $ids; do admin_api DELETE "/admin/tokens/$id/" | jq -r '"  revoked token \(.id)"'; done
}

# ----------------------------------------------------------------------- bot

bot_line() {
  jq -r '
    if .is_running then "  polling as @\(.bot_username // "?"), \((.remaining_seconds // 0) / 60 | floor) min left (until \(.active_until // "?"))"
    else "  stopped\(if .has_token == false then " (TELEGRAM_BOT_TOKEN missing)" else "" end); start it with: make bot-start" end'
}

cmd_bot_status() { admin_api GET /bot/status/ | bot_line; }

cmd_bot_start() {
  local minutes="${MINUTES:-60}"
  [[ "$minutes" =~ ^[0-9]+$ && "$minutes" -gt 0 ]] || die "MINUTES must be a positive whole number"
  admin_api POST /bot/activate/ "$(jq -nc --argjson s "$((minutes * 60))" '{duration_seconds: $s}')" | bot_line
}

cmd_bot_stop() {
  confirm bot-stop
  admin_api POST /bot/stop/ '{}' | bot_line
}

# --------------------------------------------------------------------- admin

cmd_admin_key() {
  local key
  key="$(admin_key)"
  if [[ "${SHOW:-}" == "1" ]]; then echo "$key"; else note "admin key $(mask_secret "$key")  (from $(admin_key_source); SHOW=1 prints it)"; fi
}

cmd_admin_key_rotate() {
  confirm admin-key-rotate
  local new
  new="$SLUG-$(rand_hex 16)"
  show "railway variable set ADMIN_KEY=… ${RW[*]}"
  railway variable set "${RW[@]}" "ADMIN_KEY=$new" >/dev/null
  pass_put "$SLUG" admin-key "$new"
  ok "new admin key set on Railway$(pass_available && echo ' and stored in pass') ($(mask_secret "$new"))"
  note "Railway redeploys the service; the old key stops working once it is live"
}

cmd_open() {
  local target="$URL${1:-/}"
  show "open $target"
  open "$target" 2>/dev/null || xdg-open "$target"
}

# ---------------------------------------------------------------------- main

command="${1:-}"
shift || true
case "$command" in
  info|status|logs|build|deploy|redeploy|stop|start|verify|tokens) "cmd_$command" "$@" ;;
  deploy-backend|deploy-frontend|tokens-tsv|token-create|token-revoke|token-revoke-all|bot-status|bot-start|bot-stop|admin-key|admin-key-rotate)
    "cmd_${command//-/_}" "$@" ;;
  open) cmd_open "$@" ;;
  *) echo "usage: scripts/demo.sh <command>  (see: make help)" >&2; exit 64 ;;
esac
