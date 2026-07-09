#!/usr/bin/env bash
# crypto.cpp uses boost::thread; under Emscripten use std::mutex (single-threaded WASM).
set -euo pipefail
CUSTOM="${1:?}"
F="$CUSTOM/crypto/crypto.cpp"
[[ -f "$F" ]] || exit 0
if grep -q 'NONO_EMSCRIPTEN_CRYPTO_MUTEX' "$F"; then exit 0; fi
sed -i '1i// NONO_EMSCRIPTEN_CRYPTO_MUTEX' "$F"
sed -i 's|#include <boost/thread/mutex.hpp>|#ifdef __EMSCRIPTEN__\n#include <mutex>\n#else\n#include <boost/thread/mutex.hpp>\n#endif|' "$F"
sed -i 's|#include <boost/thread/lock_guard.hpp>|#ifdef __EMSCRIPTEN__\n#include <mutex>\n#else\n#include <boost/thread/lock_guard.hpp>\n#endif|' "$F"
sed -i 's/boost::mutex/std::mutex/g' "$F"
sed -i 's/boost::lock_guard<std::mutex>/std::lock_guard<std::mutex>/g' "$F"
sed -i 's/boost::lock_guard<boost::mutex>/std::lock_guard<std::mutex>/g' "$F"
echo "Patched crypto.cpp for Emscripten"