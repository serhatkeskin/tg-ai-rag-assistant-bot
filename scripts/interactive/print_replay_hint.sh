#!/usr/bin/env bash
# Print the one-line replay of the last INTERACTIVE=1 run (called by the Makefile).
set -euo pipefail

replay_file="${1:?replay file required}"
[ -s "$replay_file" ] || exit 0
replay="$(head -n 1 "$replay_file")"
[ -n "$replay" ] || exit 0

printf '\n######################################################################\n'
printf '# INTERACTIVE: NEXT TIME — ONE-LINE REPLAY\n'
printf '######################################################################\n'
printf '  %s\n' "$replay"
printf '######################################################################\n\n'
