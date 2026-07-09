#!/usr/bin/env bash
# MyMonero + Emscripten ~3.1.44: C++14 (embind ok, no std::optional clash with boost::optional).
set -euo pipefail
ROOT="${1:?usage: patch-mymonero-cmake-cpp14.sh /root/mymonero-core-js}"
CM="$ROOT/CMakeLists.txt"
test -f "$CM"
sed -i 's/-std=c++11/-std=c++14/g' "$CM"
sed -i 's/-std=c++17/-std=c++14/g' "$CM"
if ! grep -q 'NONO_CXX14_PATCH' "$CM"; then
  sed -i '1a# NONO_CXX14_PATCH' "$CM"
fi
echo "Patched $CM to C++14"