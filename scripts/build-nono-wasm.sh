#!/usr/bin/env bash
# Build MyMonero WASM linked to NONO chain params (hempmillionaire/Nono).
# Run on a machine with ~4GB free RAM, cmake, node, npm, git.
# Output: build/MyMoneroCoreCpp_WASM.{js,wasm} → copy to Nono-web-wallet/js/mymonero-core/
set -euo pipefail

NONO_SRC="${NONO_SRC:-/root/Nono/src}"
WEB_WALLET="${WEB_WALLET:-/root/Nono-web-wallet}"
BUILD_ROOT="${BUILD_ROOT:-/root/mymonero-core-js}"
EMSDK_ROOT="${EMSDK_ROOT:-/root/emsdk}"

if [[ ! -f "$NONO_SRC/cryptonote_config.h" ]]; then
  echo "Missing NONO cryptonote_config.h at $NONO_SRC" >&2
  exit 1
fi

# --- Emscripten ---
if [[ ! -x "$EMSDK_ROOT/upstream/emscripten/emcc" ]]; then
  echo "Installing emsdk to $EMSDK_ROOT (one-time, ~15–30 min)…"
  git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_ROOT"
  cd "$EMSDK_ROOT"
  ./emsdk install 3.1.44
  ./emsdk activate 3.1.44
fi
# shellcheck source=/dev/null
source "$EMSDK_ROOT/emsdk_env.sh"
export EMSCRIPTEN="$EMSDK_ROOT/upstream/emscripten"
emcc --version | head -1

# --- mymonero-core-js ---
if [[ ! -d "$BUILD_ROOT/.git" ]]; then
  git clone https://github.com/mymonero/mymonero-core-js.git "$BUILD_ROOT"
fi
cd "$BUILD_ROOT"
git pull --ff-only || true

if [[ ! -d node_modules/@mymonero/mymonero-core-custom ]]; then
  echo "npm install (napa fetches monero-core-custom + mymonero-core-cpp)…"
  if ! command -v npm >/dev/null 2>&1; then
    echo "Installing npm (apt)…"
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq npm
  fi
  npm install
fi

CUSTOM="node_modules/@mymonero/mymonero-core-custom"
echo "Patching $CUSTOM with NONO cryptonote_config.h"
cp -a "$NONO_SRC/cryptonote_config.h" "$CUSTOM/cryptonote_config.h"
bash "$WEB_WALLET/scripts/patch-emscripten-mlocker.sh" "$CUSTOM"
bash "$WEB_WALLET/scripts/patch-emscripten-crypto-mutex.sh" "$CUSTOM"
bash "$WEB_WALLET/scripts/patch-emscripten-threadpool.sh" "$CUSTOM"
bash "$WEB_WALLET/scripts/patch-emscripten-threadpool-cpp.sh" "$CUSTOM"
bash "$WEB_WALLET/scripts/patch-mymonero-cmake-cpp14.sh" "$BUILD_ROOT"
bash "$WEB_WALLET/scripts/patch-mymonero-cmake-modularize.sh" "$BUILD_ROOT"

EMSDK_DOCKER_TAG="${EMSDK_DOCKER_TAG:-3.1.44}"

build_with_docker () {
  echo "Building WASM via emscripten/emsdk:${EMSDK_DOCKER_TAG} Docker…"
  rm -rf build monero_utils/MyMoneroCoreCpp_WASM.js monero_utils/MyMoneroCoreCpp_WASM.wasm
  mkdir -p build
  docker pull "emscripten/emsdk:${EMSDK_DOCKER_TAG}"
  docker run --rm \
    -v "$BUILD_ROOT:/app" -w /app \
    -e EMSCRIPTEN=/emsdk/upstream/emscripten \
    "emscripten/emsdk:${EMSDK_DOCKER_TAG}" \
    ./bin/archive-emcpp.sh
}

build_native () {
  echo "Building WASM via local emsdk…"
  rm -rf build
  mkdir -p build
  rm -f monero_utils/MyMoneroCoreCpp_WASM.js monero_utils/MyMoneroCoreCpp_WASM.wasm
  ./bin/archive-emcpp.sh
}

echo "Building WASM…"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if ! build_with_docker; then
    echo "Docker build failed; retrying with local emsdk…" >&2
    build_native
  fi
else
  build_native
fi

OUT_JS="$BUILD_ROOT/monero_utils/MyMoneroCoreCpp_WASM.js"
OUT_WASM="$BUILD_ROOT/monero_utils/MyMoneroCoreCpp_WASM.wasm"
test -f "$OUT_JS" && test -f "$OUT_WASM"

DEST="$WEB_WALLET/js/mymonero-core"
cp -a "$OUT_JS" "$OUT_WASM" "$DEST/"
strings "$DEST/MyMoneroCoreCpp_WASM.wasm" | grep -q '127\|NONO_GENESIS\|88888888' && echo "NONO markers found in wasm" || echo "WARN: NONO markers not found in wasm strings (may still be OK)"

echo "Done. Publish wallet:"
echo "  bash $WEB_WALLET/deploy/publish-wallet-vps.sh"
echo "Then hard-refresh dashboard and retry send."