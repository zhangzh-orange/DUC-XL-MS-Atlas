#!/usr/bin/env bash
# Rebuild the website data end-to-end:  ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
bash scripts/00_copy_raw.sh > /dev/null
python3 scripts/01_build_data.py
python3 scripts/02_layout.py
python3 scripts/03_publish.py
