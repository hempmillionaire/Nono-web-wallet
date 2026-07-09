#!/usr/bin/env bash
# Emscripten: use std::mutex instead of boost::thread (keep upstream unwrap/mlocked_arr).
set -euo pipefail
CUSTOM="${1:?usage: patch-emscripten-mlocker.sh /path/to/mymonero-core-custom}"

H="$CUSTOM/epee/include/mlocker.h"
CPP="$CUSTOM/epee/src/mlocker.cpp"

if [[ ! -f "$H" ]]; then
  echo "missing $H" >&2
  exit 1
fi

# Restore from npm if we previously overwrote with broken stub
if grep -q 'NONO emscripten patch' "$H" 2>/dev/null; then
  curl -sS 'https://raw.githubusercontent.com/mymonero/monero-core-custom/master/epee/include/mlocker.h' -o "$H"
fi

if ! grep -q 'NONO_EMSCRIPTEN_MLOCKER' "$H"; then
  sed -i 's|#include <boost/thread/mutex.hpp>|#ifdef __EMSCRIPTEN__\n#include <mutex>\n#define NONO_EMSCRIPTEN_MLOCKER 1\n#else\n#include <boost/thread/mutex.hpp>\n#endif|' "$H"
  sed -i 's/static boost::mutex &mutex();/#ifdef __EMSCRIPTEN__\n    static std::mutex \&mutex();\n#else\n    static boost::mutex \&mutex();\n#endif/' "$H"
fi

if [[ -f "$CPP" ]]; then
  sed -i 's/boost::mutex/std::mutex/g' "$CPP"
  sed -i 's/new boost::mutex/new std::mutex/g' "$CPP"
fi

echo "Patched mlocker (minimal) under $CUSTOM"