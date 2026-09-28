#!/usr/bin/env bash
#
# INTERACTIVE=1 front door for the demo Makefile (demo-maker layout).
#
#   usage: scripts/interactive/prompt.sh <out.mk> <goal>...
#
# Asks, step by step on the terminal, for the parameters the requested goals
# read, then writes them as a makefile fragment that the Makefile includes. An
# answer lands in exactly the variable the classic command line would set, so
# `make token-revoke INTERACTIVE=1` and `make token-revoke ID=4 YES=1` take the
# same path.
#
# Safety rules:
#   * Only called from `ifeq ($(INTERACTIVE),1)`; without it nothing prompts.
#   * A variable already given on the command line or in the environment is
#     not asked again.
#   * No tty means no prompting: the fragment becomes $(error ...).
#   * Prompts go to /dev/tty; stdout belongs to make's $(shell) and stays empty.
#   * Destructive goals always end with an explicit confirmation; "no" aborts.
set -euo pipefail

OUT="${1:?out file required}"
shift
GOALS="${*:-help}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$REPO/.interactive"
STATE_FILE="$STATE_DIR/last-selection"

ANSWERS=()

die_mk() { printf '$(error %s)\n' "$1" > "$OUT"; exit 0; }
abort() { die_mk "INTERACTIVE: aborted"; }
trap abort INT TERM

if [ ! -r /dev/tty ] || [ ! -w /dev/tty ]; then
  die_mk "INTERACTIVE=1 needs a terminal; pass the parameters on the command line instead"
fi

say()  { printf '%s\n' "$*" > /dev/tty; }
warn() { printf '  !! %s\n' "$*" > /dev/tty; }
ask()  { local __v; read -r -p "$1" __v < /dev/tty > /dev/tty 2>&1 || abort; REPLY_VALUE="$__v"; }
record() { ANSWERS+=("$1=$2"); }
given() { [ -n "${!1:-}" ]; }

shell_quote() {
  case "$1" in
    "")   printf "''" ;;
    *\'*) printf '%q' "$1" ;;
    *[!A-Za-z0-9_.,:/@=+-]*) printf "'%s'" "$1" ;;
    *)    printf '%s' "$1" ;;
  esac
}

replay_command() {
  local line="make $GOALS" a
  for a in ${ANSWERS[@]+"${ANSWERS[@]}"}; do line="$line ${a%%=*}=$(shell_quote "${a#*=}")"; done
  printf '%s' "$line"
}

print_replay_hint() {
  local replay
  replay="$(replay_command)"
  printf '%s\n' "$replay" > "${OUT%.mk}.cmd" 2>/dev/null || true
  say ""
  say "######################################################################"
  say "# INTERACTIVE: NEXT TIME — ONE-LINE REPLAY"
  say "######################################################################"
  say "  $replay"
  say "######################################################################"
  say ""
}

# ---------------------------------------------------------------- prompts

ask_text() {  # ask_text NAME "Question" "default" required
  local name="$1" question="$2" default="$3" required="${4:-0}"
  say ""
  say "$question"
  [ -n "$default" ] && say "  empty = $default"
  while :; do
    ask "$name: "
    if [ -z "$REPLY_VALUE" ]; then
      if [ "$required" = "1" ] && [ -z "$default" ]; then warn "$name is required"; continue; fi
      [ -n "$default" ] && record "$name" "$default"
      return
    fi
    record "$name" "$REPLY_VALUE"
    return
  done
}

ask_number() {  # ask_number NAME "Question" default
  local name="$1" question="$2" default="$3"
  say ""
  say "$question"
  while :; do
    ask "$name [empty = $default]: "
    [ -z "$REPLY_VALUE" ] && { record "$name" "$default"; return; }
    [[ "$REPLY_VALUE" =~ ^[0-9]+$ ]] && { record "$name" "$REPLY_VALUE"; return; }
    warn "a whole number, please"
  done
}

ask_yes_no() {  # ask_yes_no NAME "Question" -> records NAME=1 on yes
  local name="$1" question="$2"
  say ""
  say "$question"
  say "  1) no    [default]"
  say "  2) yes"
  while :; do
    ask "Choice [1-2, empty = no]: "
    case "$REPLY_VALUE" in
      ""|1|n|N|no|hayir|hayır) return 1 ;;
      2|y|Y|yes|evet) record "$name" 1; return 0 ;;
      *) warn "'$REPLY_VALUE' is not 1 or 2" ;;
    esac
  done
}

# Token picker: the live list comes from the admin API through demo.sh.
ask_token() {
  local filter="$1" rows i=1 ids=()
  say ""
  say "Loading demo tokens…"
  rows="$(cd "$REPO" && bash scripts/demo.sh tokens-tsv 2>/dev/null || true)"
  if [ -n "$filter" ]; then rows="$(grep -E "$filter" <<<"$rows" || true)"; fi
  if [ -z "$rows" ]; then
    warn "no tokens found (backend asleep or no admin key?) — type the id"
    ask_text ID "Token id:" "" 1
    return
  fi
  say "Which token?"
  while IFS=$'\t' read -r id label; do
    say "  $i) #$id  $label"
    ids+=("$id")
    i=$((i + 1))
  done <<<"$rows"
  while :; do
    ask "Choice [1-${#ids[@]}]: "
    if [[ "$REPLY_VALUE" =~ ^[0-9]+$ ]] && [ "$REPLY_VALUE" -ge 1 ] && [ "$REPLY_VALUE" -le "${#ids[@]}" ]; then
      record ID "${ids[$((REPLY_VALUE - 1))]}"
      return
    fi
    warn "'$REPLY_VALUE' is not between 1 and ${#ids[@]}"
  done
}

# ---------------------------------------------------------------- goal -> questions

SLUG_NAME="$(sed -n 's/^SLUG *?= *//p' "$REPO/Makefile" | head -n1)"

questions_for() {
  case "$1" in
    token-create)
      given LABEL || ask_text LABEL "Label (who is this token for, in one word?):" "" 1
      given DAYS  || ask_number DAYS "Valid for how many days?" 7
      given LIMIT || ask_text LIMIT "Query limit (empty = unlimited):" "" ;;
    token-revoke)
      given ID  || ask_token "active"
      given YES || ask_yes_no YES "Revoke token #${ID:-$(last_answer ID)}? It stops working at once." || abort ;;
    token-revoke-all)
      given YES || ask_yes_no YES "Revoke EVERY active token? Every viewer loses access." || abort ;;
    stop)
      given YES || ask_yes_no YES "Stop the $SLUG_NAME backend? The API answers 5xx until: make start" || abort ;;
    bot-start)
      given MINUTES || ask_number MINUTES "Keep the Telegram bot polling for how many minutes?" 60 ;;
    bot-stop)
      given YES || ask_yes_no YES "Stop the Telegram bot now?" || abort ;;
    admin-key-rotate)
      given YES || ask_yes_no YES "Rotate the admin key? Railway redeploys the service." || abort ;;
    admin-key)
      given SHOW || { ask_yes_no SHOW "Print the full admin key on screen?" || true; } ;;
    logs)
      given LOG_LINES || ask_number LOG_LINES "How many log lines?" 100 ;;
    *) ;;
  esac
}

last_answer() {
  local a value=""
  for a in ${ANSWERS[@]+"${ANSWERS[@]}"}; do [ "${a%%=*}" = "$1" ] && value="${a#*=}"; done
  printf '%s' "$value"
}

say "==> interactive parameters for: make $GOALS"
for goal in $GOALS; do questions_for "$goal"; done

if [ ${#ANSWERS[@]} -gt 0 ]; then
  mkdir -p "$STATE_DIR"
  (umask 077; { printf 'GOALS=%s\n' "$GOALS"; printf '%s\n' "${ANSWERS[@]}"; } > "$STATE_FILE")
fi
print_replay_hint

{
  echo "# generated by scripts/interactive/prompt.sh — INTERACTIVE=1 answers for: $GOALS"
  for a in ${ANSWERS[@]+"${ANSWERS[@]}"}; do
    printf '%s := %s\n' "${a%%=*}" "${a#*=}"
    printf 'export %s\n' "${a%%=*}"
  done
  printf 'INTERACTIVE_REPLAY_FILE := %s\n' "${OUT%.mk}.cmd"
} > "$OUT"

trap - INT TERM
exit 0
