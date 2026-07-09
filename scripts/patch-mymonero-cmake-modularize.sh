#!/usr/bin/env bash
# Emscripten 3.1+: NODEJS_CATCH_EXIT/REJECTION conflict with MODULARIZE.
set -euo pipefail
CM="${1:?}/CMakeLists.txt"
[[ -f "$CM" ]] || exit 0
sed -i '/NODEJS_CATCH_EXIT/d; /NODEJS_CATCH_REJECTION/d' "$CM"
echo "Patched $CM (MODULARIZE link flags)"