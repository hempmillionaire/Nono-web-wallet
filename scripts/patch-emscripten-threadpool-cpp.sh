#!/usr/bin/env bash
# threadpool.cpp: inline jobs on Emscripten (see threadpool.sh for .h).
set -euo pipefail
CUSTOM="${1:?}"
F="$CUSTOM/common/threadpool.cpp"
[[ -f "$F" ]] || exit 0
grep -q 'NONO_EMSCRIPTEN_THREADPOOL' "$F" && exit 0
python3 <<'PY'
from pathlib import Path
p = Path("/root/mymonero-core-js/node_modules/@mymonero/mymonero-core-custom/common/threadpool.cpp")
text = p.read_text()
marker = '#include "common/threadpool.h"'
insert = marker + '\n\n// NONO_EMSCRIPTEN_THREADPOOL\n#ifdef __EMSCRIPTEN__\n#define NONO_TP_INLINE 1\n#endif\n'
if 'NONO_EMSCRIPTEN_THREADPOOL' not in text:
    text = text.replace(marker, insert, 1)
old_create = '''void threadpool::create(unsigned int max_threads) {
  const boost::unique_lock<boost::mutex> lock(mutex);
  boost::thread::attributes attrs;
  attrs.set_stack_size(THREAD_STACK_SIZE);
  max = max_threads ? max_threads : tools::get_max_concurrency();
  size_t i = max ? max - 1 : 0;
  running = true;
  while(i--) {
    threads.push_back(boost::thread(attrs, boost::bind(&threadpool::run, this, false)));
  }
}'''
new_create = '''void threadpool::create(unsigned int max_threads) {
#ifdef NONO_TP_INLINE
  (void)max_threads;
  max = 1;
  running = true;
  threads.clear();
  return;
#endif
  const boost::unique_lock<boost::mutex> lock(mutex);
  boost::thread::attributes attrs;
  attrs.set_stack_size(THREAD_STACK_SIZE);
  max = max_threads ? max_threads : tools::get_max_concurrency();
  size_t i = max ? max - 1 : 0;
  running = true;
  while(i--) {
    threads.push_back(boost::thread(attrs, boost::bind(&threadpool::run, this, false)));
  }
}'''
if old_create in text:
    text = text.replace(old_create, new_create)
old_submit = '''void threadpool::submit(waiter *obj, std::function<void()> f, bool leaf) {
  CHECK_AND_ASSERT_THROW_MES(!is_leaf, "A leaf routine is using a thread pool");
  boost::unique_lock<boost::mutex> lock(mutex);
  if (!leaf && ((active == max && !queue.empty()) || depth > 0)) {
    // if all available threads are already running
    // and there's work waiting, just run in current thread
    lock.unlock();
    ++depth;
    is_leaf = leaf;
    f();
    --depth;
    is_leaf = false;
  } else {
    if (obj)
      obj->inc();
    if (leaf)
      queue.push_front({obj, f, leaf});
    else
      queue.push_back({obj, f, leaf});
    has_work.notify_one();
  }
}'''
new_submit = '''void threadpool::submit(waiter *obj, std::function<void()> f, bool leaf) {
#ifdef NONO_TP_INLINE
  (void)leaf;
  if (obj) obj->inc();
  try { f(); } catch (...) { if (obj) obj->set_error(); throw; }
  if (obj) obj->dec();
  return;
#endif
  CHECK_AND_ASSERT_THROW_MES(!is_leaf, "A leaf routine is using a thread pool");
  boost::unique_lock<boost::mutex> lock(mutex);
  if (!leaf && ((active == max && !queue.empty()) || depth > 0)) {
    lock.unlock();
    ++depth;
    is_leaf = leaf;
    f();
    --depth;
    is_leaf = false;
  } else {
    if (obj)
      obj->inc();
    if (leaf)
      queue.push_front({obj, f, leaf});
    else
      queue.push_back({obj, f, leaf});
    has_work.notify_one();
  }
}'''
if old_submit in text:
    text = text.replace(old_submit, new_submit)
p.write_text(text)
print('patched cpp', p)
PY