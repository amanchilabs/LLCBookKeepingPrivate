#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${LLCB_IOS_DEVELOPMENT_TEAM:?Set the development team for the app Simulator Keychain namespace}"
LLCB_SIMULATOR_ID="${1:?Usage: LLCB_IOS_DEVELOPMENT_TEAM=TEAM scripts/build-ios-simulator.sh SIMULATOR_UUID}"
LLCB_DERIVED_DATA="${LLCB_IOS_DERIVED_DATA:-${TMPDIR:-/tmp}/llc-bookkeeping-derived}"
LLCB_NODE_BINARY="$(command -v node)"
if [[ "$(node --version)" != "v$(cat .node-version)" ]]; then
  printf 'Use the Node version pinned in .node-version before building.\n' >&2
  exit 1
fi
# Generated/ignored machine-local input; no global toolchain settings are changed.
printf 'export NODE_BINARY=%q\n' "$LLCB_NODE_BINARY" > ios/.xcode.env.local
xcodebuild -workspace ios/LLCBookKeepingPrivate.xcworkspace -scheme LLCBookKeepingPrivate \
  -configuration Debug -sdk iphonesimulator -destination "id=$LLCB_SIMULATOR_ID" \
  -derivedDataPath "$LLCB_DERIVED_DATA" -jobs 2 \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- "DEVELOPMENT_TEAM=$LLCB_IOS_DEVELOPMENT_TEAM" build
# Simulator entitlements are embedded by the linker, not necessarily displayed by
# codesign's ordinary signature-entitlement inspection. Never repair by re-signing.
LLCB_SIMULATED_ENTITLEMENTS="$LLCB_DERIVED_DATA/Build/Intermediates.noindex/LLCBookKeepingPrivate.build/Debug-iphonesimulator/LLCBookKeepingPrivate.build/LLCBookKeepingPrivate.app-Simulated.xcent"
LLCB_APPLICATION_ID="$(/usr/bin/plutil -extract application-identifier raw -o - "$LLCB_SIMULATED_ENTITLEMENTS")"
[[ "$LLCB_APPLICATION_ID" == "$LLCB_IOS_DEVELOPMENT_TEAM.com.amanchilabs.llcbookkeepingprivate" ]]
printf 'PASS: Xcode generated the app-owned Simulator Keychain identity. Runtime acceptance remains separate.\n'
