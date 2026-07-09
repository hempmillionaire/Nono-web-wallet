#!/usr/bin/env bash
# C++14 + pthread for boost::thread under Emscripten (MyMonero WASM).
set -euo pipefail
ROOT="${1:?usage: patch-mymonero-cmake-emscripten.sh /root/mymonero-core-js}"
CM="$ROOT/CMakeLists.txt"
test -f "$CM"

bash "$(dirname "$0")/patch-mymonero-cmake-cpp14.sh" "$ROOT"

if grep -q 'NONO_EMSCRIPTEN_PTHREAD' "$CM"; then
  echo "CMakeLists already has NONO pthread patch"
  exit 0
fi

# Compile + link with pthread (required by boost::thread in monero-core-custom)
perl -i -0pe 's/SET\(CMAKE_CXX_FLAGS "\$\{CMAKE_CXX_FLAGS\} -std=c\+\+14/SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread -std=c++14/s' "$CM"
perl -i -pe 's/-std=c\+\+14 \\\\/-std=c++14 \\\n-pthread \\\n-s USE_PTHREADS=1 \\\n-s PTHREAD_POOL_SIZE=4 \\\\/ if $.==1..1 && !/NONO_EMSCRIPTEN_PTHREAD/;' "$CM" 2>/dev/null || true

# Append pthread to linker block if not present
if ! grep -q 'USE_PTHREADS' "$CM"; then
  sed -i 's|-O3 \\\\|-O3 \\\n-pthread \\\n-s USE_PTHREADS=1 \\\n-s PTHREAD_POOL_SIZE=4 \\\\|' "$CM"
fi

sed -i '1a# NONO_EMSCRIPTEN_PTHREAD' "$CM"
echo "Patched $CM for Emscripten pthread"