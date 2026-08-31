#!/usr/bin/env bash
set -euo pipefail

# SwapPulse Network Milestone 1 verification.
# Expected toolchain:
#   Scarb/Cairo 2.13.1
#   Starknet Foundry 0.51.2
#   universal-sierra-compiler 2.8.0
#
# Override the binaries with SCARB_BIN / SNFORGE_BIN when they are not on PATH.

SCARB_BIN="${SCARB_BIN:-scarb}"
SNFORGE_BIN="${SNFORGE_BIN:-snforge}"

"$SCARB_BIN" --version
"$SNFORGE_BIN" --version

"$SCARB_BIN" build
"$SNFORGE_BIN" test

# Foundry 0.51 cannot convert a constructor deployment revert into a normal
# #[should_panic] result. Run the deliberately failing zero-key deployment in
# isolation and require the exact contract guard to appear in its output.
set +e
negative_output="$($SNFORGE_BIN test constructor_rejects_zero_public_key --ignored 2>&1)"
negative_status=$?
set -e

if [[ $negative_status -eq 0 ]]; then
  echo "ERROR: zero-public-key constructor negative test unexpectedly succeeded" >&2
  exit 1
fi

if ! grep -q "INVALID_PUBLIC_KEY" <<<"$negative_output"; then
  echo "$negative_output" >&2
  echo "ERROR: zero-public-key constructor failed for the wrong reason" >&2
  exit 1
fi

echo "PASS: constructor rejects zero public key with INVALID_PUBLIC_KEY"
