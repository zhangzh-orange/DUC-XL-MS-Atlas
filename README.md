# DUC-XL-MS Atlas — web visualization

Interactive companion site for *Site-resolved spatial and structural interactome of a human cell*.
The design borrows from OpenCell (protein-centric pages) and EndoMAP (network + structure browser) and
follows the paper's three axes: **spatial**, **structural**, **systems**.

## Layout

```
Web_Visualization/
├── build.sh              one-shot rebuild (copy → process → layout → publish)
├── data/
│   ├── raw/              copied from Nature_manuscripts (Tables S1–S5, FASTA, complex models)
│   └── processed/        JSON produced by scripts
├── scripts/
│   ├── 00_copy_raw.sh    copy source files into data/raw/
│   ├── 01_build_data.py  tables → JSON (proteins, network, per-protein shards, SLiMs, complexes)
│   ├── 02_layout.py      organelle-anchored force layout of the core interactome
│   └── 03_publish.py     copy data/processed/ into site/data/; stamp ?v=<hash> on css/js links
└── site/                 the static website (deploy this folder only)
    ├── index.html, css/, js/
    └── data/             JSON and structure files loaded by the site
```

## Pages

| Route | Content |
|---|---|
| `#/` | search, organelle cell map, headline numbers |
| `#/protein/<UniProt>` | localization evidence, ego network, membrane topology, residue-level cross-link map, interactors, SLiMs |
| `#/network` | WebGL network (28,048 PPIs) with evidence / residue-pair / compartment filters |
| `#/organelles`, `#/topology`, `#/contacts` | spatial layer (Tables S2–S3) |
| `#/slims`, `#/complexes`, `#/complex/<name>` | structural layer (Table S4, CORVET/HOPS/exocyst/WASH 3D with cross-links) |
| `#/systems` | augmentation sources and augmented edges (Table S5) |

## Run locally

```bash
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

(Opening `index.html` directly from disk does not work — browsers block `fetch` on `file://`.)

## Deploy

* **GitHub Pages** (https://zhangzh-orange.github.io/DUC-XL-MS-Atlas/): `.github/workflows/pages.yml`
  publishes `site/` on every push to `main`. One-time setup: repository Settings → Pages →
  Source: **GitHub Actions**. The repo-level `.gitignore` keeps the source `data/` out of git.
* **Institutional server**: copy `site/` to the web root.

The site has no access control: anyone with the URL can view and download the data in `site/data/`.

## Notes

* Organelle colours: Paul Tol *muted* (colour-blind safe), hue-matched to the Fig. 1A palette.
* 620 original edges in Table S5 cannot be traced to a cell line by gene symbol; they are labelled
  "DUC-XL-MS (cell line unresolved)". 224 network nodes have no UniProt accession match and have no protein page.
* Reference structures (secondary views): yeast CORVET 8QX8 and HOPS 7ZU0 (Supplementary Note 2, with TM-align
  RMSD tables), ERH·CIZ1 7X39 and RACK1 in the 40S 8GLP (Fig. 4E,F; downloaded from RCSB by `00_copy_raw.sh`,
  8GLP trimmed to RACK1 + 25 Å context).
* Code links and the XL_MOPLC schematic (`site/img/xl_moplc_pipeline.png`) come from
  https://github.com/zhangzh-orange/DUC-XL-MS (MIT).
* Libraries via CDN: graphology 0.25.4, sigma 2.4.0, 3Dmol 2.4.0.
