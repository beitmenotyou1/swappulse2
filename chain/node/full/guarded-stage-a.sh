#!/usr/bin/env bash

# Guarded Madara Stage-A trial for the always-on SwapPulse mini-server.
# Starts only the isolated swappulse-full-lab Compose project, watches host and
# live-service health, and stops Madara automatically if guard thresholds trip.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
DURATION_SECONDS="${STAGE_A_DURATION_SECONDS:-900}"
INTERVAL_SECONDS="${STAGE_A_INTERVAL_SECONDS:-15}"
MIN_MEM_KIB="${STAGE_A_MIN_MEM_KIB:-1572864}" # 1.5 GiB
MAX_MEM_PSI_AVG10="${STAGE_A_MAX_MEM_PSI_AVG10:-10.0}"
FAIL=0

stop_lab() {
  docker compose -p swappulse-full-lab \
    --env-file "$HERE/.env" \
    --env-file "$HERE/.env.image" \
    -f "$HERE/docker-compose.client-lab.yml" \
    down >/dev/null 2>&1 || true
}

trap 'printf "\nInterrupted. Stopping only swappulse-full-lab...\n"; stop_lab; exit 130' INT TERM

check_http() {
  local url="$1"
  curl -fsS --max-time 5 "$url" >/dev/null 2>&1
}

mem_available_kib() {
  awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null
}

memory_psi_avg10() {
  if [ -r /proc/pressure/memory ]; then
    awk '/^some / {for(i=1;i<=NF;i++) if($i ~ /^avg10=/){sub(/^avg10=/,"",$i); print $i; exit}}' /proc/pressure/memory
  else
    printf '0\n'
  fi
}

float_gt() {
  awk -v a="$1" -v b="$2" 'BEGIN {exit !(a>b)}'
}

printf '=== guarded Madara Stage-A trial ===\n'
printf 'duration: %ss\n' "$DURATION_SECONDS"
printf 'interval: %ss\n' "$INTERVAL_SECONDS"
printf 'minimum MemAvailable: %s KiB\n' "$MIN_MEM_KIB"
printf 'maximum memory PSI some avg10: %s\n' "$MAX_MEM_PSI_AVG10"
printf '\n'

bash "$HERE/start-client-lab.sh" || exit 1

STARTED="$(date +%s)"
while :; do
  NOW="$(date +%s)"
  ELAPSED=$((NOW - STARTED))
  if [ "$ELAPSED" -ge "$DURATION_SECONDS" ]; then
    break
  fi

  MEM="$(mem_available_kib)"
  PSI="$(memory_psi_avg10)"
  CONTAINER_STATE="$(docker inspect -f '{{.State.Status}}' swappulse-full-lab-madara-full-lab-1 2>/dev/null || true)"

  printf '[%4ss] container=%s mem_available_kib=%s memory_psi_avg10=%s\n' \
    "$ELAPSED" "${CONTAINER_STATE:-missing}" "${MEM:-unknown}" "${PSI:-unknown}"

  if [ "$CONTAINER_STATE" != "running" ]; then
    printf 'GUARD TRIP: Madara container is not running.\n'
    FAIL=1
    break
  fi

  if [ -n "$MEM" ] && [ "$MEM" -lt "$MIN_MEM_KIB" ]; then
    printf 'GUARD TRIP: MemAvailable dropped below protected threshold.\n'
    FAIL=1
    break
  fi

  if [ -n "$PSI" ] && float_gt "$PSI" "$MAX_MEM_PSI_AVG10"; then
    printf 'GUARD TRIP: memory PSI exceeded protected threshold.\n'
    FAIL=1
    break
  fi

  if ! check_http http://127.0.0.1:18080/healthz; then
    printf 'GUARD TRIP: live SwapPulse RPC gateway health check failed.\n'
    FAIL=1
    break
  fi
  if ! check_http http://127.0.0.1:18081/healthz; then
    printf 'GUARD TRIP: live SwapPulse transaction relay health check failed.\n'
    FAIL=1
    break
  fi
  if ! check_http http://127.0.0.1:18100/healthz; then
    printf 'GUARD TRIP: live SwapPulse lite-node health check failed.\n'
    FAIL=1
    break
  fi

  sleep "$INTERVAL_SECONDS"
done

printf '\n=== final Madara container snapshot ===\n'
docker stats --no-stream swappulse-full-lab-madara-full-lab-1 2>/dev/null || true

printf '\n=== recent Madara logs ===\n'
docker logs --tail 80 swappulse-full-lab-madara-full-lab-1 2>&1 || true

if [ "$FAIL" -ne 0 ]; then
  printf '\nStage-A guard failed. Stopping only Madara lab now.\n'
  stop_lab
  exit 1
fi

printf '\nStage-A guarded window completed without tripping host/live-service protection.\n'
printf 'Madara remains running for explicit verification/benchmarking.\n'
