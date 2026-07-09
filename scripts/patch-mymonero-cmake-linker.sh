#!/usr/bin/env bash
# Fix EMCC_LINKER_FLAGS__WASM (single backslash continuations; pthread optional).
set -euo pipefail
ROOT="${1:?}"
CM="$ROOT/CMakeLists.txt"
python3 <<'PY'
import re, pathlib, sys
p = pathlib.Path(sys.argv[1])
text = p.read_text()
block = '''set (EMCC_LINKER_FLAGS__WASM
"-Wall \\\\
-gsource-map \\\\
-std=c++14 \\\\
-flto \\\\
--bind \\\\
-s STRICT=1 \\\\
-s MODULARIZE=1 \\\\
-s 'EXPORT_NAME=\\\\"MyMoneroClient\\\\"' \\\\
-s WASM=1 \\\\
-s ASSERTIONS=2 \\\\
-s DEMANGLE_SUPPORT=1 \\\\
-s ALLOW_MEMORY_GROWTH=1 \\\\
-s NO_DISABLE_EXCEPTION_CATCHING \\\\
-s NODEJS_CATCH_EXIT=1 \\\\
-s NODEJS_CATCH_REJECTION=0 \\\\
-s ERROR_ON_UNDEFINED_SYMBOLS=1 \\\\
-s EXPORTED_RUNTIME_METHODS='[\\\\"UTF8ToString\\\\",\\\\"stringToUTF8\\\\"]' \\\\
-O3 \\\\
-pthread \\\\
-s USE_PTHREADS=1 \\\\
-s PTHREAD_POOL_SIZE=4 \\\\
--source-map-base ${CMAKE_CURRENT_LIST_DIR}/sourcemap \\\\
--memory-init-file 1 \\\\
")'''
text2, n = re.subn(
    r'set \(EMCC_LINKER_FLAGS__WASM\n.*?\n"\)\s*',
    block + '\n',
    text,
    count=1,
    flags=re.DOTALL,
)
if n != 1:
    print('linker block not found', file=sys.stderr)
    sys.exit(1)
p.write_text(text2)
print('Fixed linker flags in', p)
PY
"$CM"