#!/usr/bin/env python3
"""Copy data/processed/ into site/data/ so the static site can load it, copy the
supplementary tables into site/downloads/ under descriptive names, and stamp
content hashes onto the CSS/JS links in index.html (cache busting)."""
import hashlib
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "processed"
DST = ROOT / "site" / "data"
TABLES = ROOT / "data" / "raw" / "tables"
DOWNLOADS = {  # raw supplementary table -> published file name (site/downloads/)
    "Supplementary_Table_1_DUC-XL-MS_crosslinks.xlsx": "DUC-XL-MS_crosslinks_and_PPIs.xlsx",
    "Supplementary_Table_2_HEK_markers.xlsx": "DUC-XL-MS_organelle_topology_markers.xlsx",
    "Supplementary_Table_3_HEK_propagation_and_topology.xlsx": "DUC-XL-MS_localization_topology_contacts.xlsx",
    "Supplementary_Table_4_SLiM_candidates.xlsx": "DUC-XL-MS_SLiM_candidates.xlsx",
    "Supplementary_Table_5_augmented_core_interactome.xlsx": "DUC-XL-MS_augmented_core_interactome.xlsx",
}


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
    dl = DST.parent / "downloads"
    dl.mkdir(exist_ok=True)
    for src, name in DOWNLOADS.items():
        shutil.copyfile(TABLES / src, dl / name)
    print(f"published {len(DOWNLOADS)} tables into {dl}")
    stamp_assets()


def stamp_assets():
    """Append ?v=<hash of file> to local css/js references so browsers refetch changed files."""
    site = DST.parent
    index = site / "index.html"
    html = index.read_text(encoding="utf-8")

    def repl(m):
        path = m.group(2)
        digest = hashlib.sha1((site / path).read_bytes()).hexdigest()[:10]
        return f'{m.group(1)}{path}?v={digest}"'

    html = re.sub(r'((?:src|href)=")((?:js|css)/[^"?]+)(?:\?v=[^"]*)?"', repl, html)
    index.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
