#!/usr/bin/env bash
set -euo pipefail

# SwapPulse Network V2 contract verification.
# Pinned toolchain:
#   Scarb/Cairo 2.13.1
#   Starknet Foundry 0.51.2
#   universal-sierra-compiler 2.8.0 (enforced again by deploy-contracts.sh)
#
# Override the binaries with SCARB_BIN / SNFORGE_BIN when they are not on PATH.

SCARB_BIN="${SCARB_BIN:-scarb}"
SNFORGE_BIN="${SNFORGE_BIN:-snforge}"
EXPECTED_SCARB_VERSION="2.13.1"
EXPECTED_SNFORGE_VERSION="0.51.2"

scarb_version="$("$SCARB_BIN" --version | head -n1 | awk '{print $2}')"
snforge_version="$("$SNFORGE_BIN" --version | head -n1 | awk '{print $2}')"
if [[ "$scarb_version" != "$EXPECTED_SCARB_VERSION" ]]; then
  echo "ERROR: Scarb $EXPECTED_SCARB_VERSION is required, found ${scarb_version:-unknown}" >&2
  exit 1
fi
if [[ "$snforge_version" != "$EXPECTED_SNFORGE_VERSION" ]]; then
  echo "ERROR: Starknet Foundry $EXPECTED_SNFORGE_VERSION is required, found ${snforge_version:-unknown}" >&2
  exit 1
fi

echo "Scarb $scarb_version"
echo "Starknet Foundry $snforge_version"

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
