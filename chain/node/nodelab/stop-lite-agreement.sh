#!/usr/bin/env bash

# Stop only the isolated host-process SWAPPULSE_NODELAB_1 lite verifier.
# The live containerised lite node on 18100 is not modified.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
DATA_DIR="$HERE/lite-agreement-data"
PID_FILE="$DATA_DIR/lite.pid"

if [ ! -f "$PID_FILE" ]; then
  printf 'No node-lab lite PID file is present. Nothing to stop.\n'
  exit 0
fi

PID="$(sed -n '1p' "$PID_FILE" 2>/dev/null || true)"
EXPECTED_SERVER="$(sed -n '2p' "$PID_FILE" 2>/dev/null || true)"
if ! printf '%s' "$PID" | grep -Eq '^[0-9]+$'; then
  printf 'Invalid node-lab lite PID file. Refusing to signal an unknown process.\n'
  exit 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
  printf 'Node-lab lite process %s is already stopped.\n' "$PID"
  rm -f "$PID_FILE"
  exit 0
fi

if [ -z "$EXPECTED_SERVER" ] || [ ! -r "/proc/$PID/cmdline" ]; then
  printf 'Could not verify PID %s belongs to the node-lab lite server. Refusing to signal it.\n' "$PID"
  exit 1
fi
CMDLINE="$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null || true)"
case "$CMDLINE" in
  *"$EXPECTED_SERVER"*) ;;
  *)
    printf 'PID %s no longer matches the recorded node-lab lite server. Refusing to signal it.\n' "$PID"
    exit 1
    ;;
esac

printf 'Stopping only node-lab lite verifier PID %s with SIGTERM.\n' "$PID"
kill "$PID"

for ATTEMPT in $(seq 1 20); do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    printf 'Node-lab lite verifier stopped cleanly. Checkpoint/data preserved in %s.\n' "$DATA_DIR"
    exit 0
  fi
  sleep 1
done

printf 'Node-lab lite verifier is still running after 20 seconds.\n'
printf 'No forced kill was sent. Inspect PID %s before taking further action.\n' "$PID"
exit 1
