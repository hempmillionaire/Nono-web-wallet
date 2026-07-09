#!/usr/bin/env bash
# MyMonero upstream pins C++11; current Emscripten embind requires C++17.
set -euo pipefail
ROOT="${1:?usage: patch-mymonero-cmake-cpp17.sh /root/mymonero-core-js}"
CM="$ROOT/CMakeLists.txt"
test -f "$CM"
sed -i 's/-std=c++11/-std=c++17/g' "$CM"
sed -i 's/-std=c++14/-std=c++17/g' "$CM"
if ! grep -q 'NONO_CXX17_PATCH' "$CM"; then
  sed -i '1a# NONO_CXX17_PATCH' "$CM"
fi
echo "Patched $CM to C++17"