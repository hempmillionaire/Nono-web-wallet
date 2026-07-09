#!/usr/bin/env bash
# One-shot: C++14, modularize-safe linker, pthread, no NODEJS_CATCH_*.
set -euo pipefail
ROOT="${1:?}"
CM="$ROOT/CMakeLists.txt"
curl -sS 'https://raw.githubusercontent.com/mymonero/mymonero-core-js/master/CMakeLists.txt' -o "$CM.nono-base"
# Keep SRC_FILES from existing if present; else use downloaded
if [[ -f "$CM" ]] && grep -q 'NONO_WASM_CMAKE' "$CM" 2>/dev/null; then
  :
else
  cp "$CM.nono-base" "$CM"
fi
sed -i 's/-std=c++11/-std=c++14/' "$CM"
sed -i 's/SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")/SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread -std=c++14 -Wno-enum-constexpr-conversion")/' "$CM" 2>/dev/null || true
if ! grep -q 'pthread -std=c++14' "$CM"; then
  sed -i '1a SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread -std=c++14 -Wno-enum-constexpr-conversion")' "$CM"
fi
sed -i '/NODEJS_CATCH_EXIT/d; /NODEJS_CATCH_REJECTION/d' "$CM"
# Insert -pthread before -O3 in linker block if missing
if ! grep -q '\-pthread' "$CM" || ! grep -A20 EMCC_LINKER | grep -q pthread; then
  sed -i '/-O3 \\/i -pthread \\' "$CM"
fi
sed -i 's/COMPILE_FLAGS "-s USE_BOOST_HEADERS=1"/COMPILE_FLAGS "-pthread -s USE_BOOST_HEADERS=1"/' "$CM"
echo '# NONO_WASM_CMAKE' >> "$CM"
echo "Patched $CM"