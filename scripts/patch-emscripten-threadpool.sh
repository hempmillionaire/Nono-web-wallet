#!/usr/bin/env bash
# threadpool.h: boost::thread unavailable on Emscripten — alias to std.
set -euo pipefail
CUSTOM="${1:?}"
H="$CUSTOM/common/threadpool.h"
[[ -f "$H" ]] || exit 0
grep -q 'NONO_EMSCRIPTEN_THREADPOOL_H' "$H" && exit 0
python3 <<PY
from pathlib import Path
p = Path("$H")
text = p.read_text()
old = '''#include <boost/thread/condition_variable.hpp>
#include <boost/thread/mutex.hpp>
#include <boost/thread/thread.hpp>'''
new = '''// NONO_EMSCRIPTEN_THREADPOOL_H
#ifdef __EMSCRIPTEN__
#include <condition_variable>
#include <mutex>
#include <thread>
namespace boost {
  using mutex = std::mutex;
  using condition_variable = std::condition_variable;
  using thread = std::thread;
}
#else
#include <boost/thread/condition_variable.hpp>
#include <boost/thread/mutex.hpp>
#include <boost/thread/thread.hpp>
#endif'''
if old not in text:
    raise SystemExit('threadpool.h include block not found')
p.write_text(text.replace(old, new, 1))
print('patched', p)
PY