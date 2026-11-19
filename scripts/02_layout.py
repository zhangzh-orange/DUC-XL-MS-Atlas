#!/usr/bin/env python3
"""Organelle-anchored force layout of the core interactome.

Each annotated protein is tied to a fixed anchor node per compartment, so the
map reads like a cell (nucleus centre, ER beside it, Golgi/endosomes towards
the periphery); unannotated proteins settle next to their cross-link partners.
Writes data/processed/network_layout.json: [[x, y], ...] in node order.
"""
import json
from pathlib import Path

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed"

ANCHORS = {
    "nucleus": (0.0, 0.0),
    "endoplasmic_reticulum": (-0.55, 0.25),
    "golgi": (0.35, 0.6),
    "endosome": (0.7, 0.15),
    "lysosome": (0.55, -0.45),
    "plasma_membrane": (-0.1, 0.95),
    "mitochondrion": (-0.35, -0.65),
    "peroxisome": (-0.85, -0.35),
}
ANCHOR_WEIGHT = 3.0


def main():
    net = json.load(open(OUT / "network_edges.json"))
    prot = json.load(open(OUT / "proteins.json"))
    loc_of = dict(zip(prot["acc"], prot["loc"]))

    g = nx.Graph()
    n = len(net["nodes"])
    g.add_nodes_from(range(n))
    for e in net["edges"]:
        g.add_edge(e[0], e[1], weight=1.0)

    rng = np.random.default_rng(7)
    pos = {}
    for name, xy in ANCHORS.items():
        a = f"@{name}"
        g.add_node(a)
        pos[a] = np.array(xy)
    for i, acc in enumerate(net["acc"]):
        loc = loc_of.get(acc) if acc else None
        comps = [c for c in (loc or "").split(";") if c in ANCHORS]
        for c in comps:
            g.add_edge(i, f"@{c}", weight=ANCHOR_WEIGHT / len(comps))
        centre = np.mean([ANCHORS[c] for c in comps], axis=0) if comps else np.zeros(2)
        pos[i] = centre + rng.normal(0, 0.25, 2)

    lay = nx.spring_layout(g, pos=pos, fixed=[f"@{c}" for c in ANCHORS],
                           k=0.02, iterations=80, weight="weight", seed=7)
    xy = np.array([lay[i] for i in range(n)])
    # pull small disconnected components (pushed far out by repulsion) onto a ring
    # just outside the main cloud, so they do not shrink the visible map
    main = max(nx.connected_components(g.subgraph(range(n))), key=len)
    r = np.linalg.norm(xy, axis=1)
    lim = np.percentile(r[list(main)], 99) * 1.08
    out = r > lim
    xy[out] *= (lim / r[out])[:, None]
    json.dump([[round(float(x), 4), round(float(y), 4)] for x, y in xy],
              open(OUT / "network_layout.json", "w"), separators=(",", ":"))
    print("layout written for", n, "nodes")


if __name__ == "__main__":
    main()
