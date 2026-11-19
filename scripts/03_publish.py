#!/usr/bin/env python3
"""Copy data/processed/ into site/data/ so the static site can load it."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "processed"
DST = ROOT / "site" / "data"


def main():
    if DST.exists():
        shutil.rmtree(DST)
    n = 0
    for f in sorted(SRC.rglob("*")):
        if f.is_file():
            out = DST / f.relative_to(SRC)
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(f, out)
            n += 1
    print(f"published {n} files into {DST}")


if __name__ == "__main__":
    main()
