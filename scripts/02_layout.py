#!/usr/bin/env python3
"""Organelle-anchored force layout of the core interactome.

The largest connected component is laid out with each annotated protein tied
to a fixed anchor node per compartment, so the map reads like a cell (nucleus
centre, ER beside it, Golgi/endosomes towards the periphery); unannotated
proteins settle next to their cross-link partners.

Small disconnected components (pairs, triplets, ...) are laid out one by one
at the same edge length as the main component and arranged on concentric
rings around it, each turned along the ring, so their interactions stay visible.
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
GAP = 1.2  # spacing between packed components, in units of the main edge length


def layout_main(g, nodes, loc_of, acc_of):
    """Spring layout of the main component pulled towards organelle anchors."""
    h = g.subgraph(nodes).copy()
    rng = np.random.default_rng(7)
    pos = {}
    for name, xy in ANCHORS.items():
        h.add_node(f"@{name}")
        pos[f"@{name}"] = np.array(xy)
    for i in nodes:
        loc = loc_of.get(acc_of[i]) if acc_of[i] else None
        comps = [c for c in (loc or "").split(";") if c in ANCHORS]
        for c in comps:
            h.add_edge(i, f"@{c}", weight=ANCHOR_WEIGHT / len(comps))
        centre = np.mean([ANCHORS[c] for c in comps], axis=0) if comps else np.zeros(2)
        pos[i] = centre + rng.normal(0, 0.25, 2)
    lay = nx.spring_layout(h, pos=pos, fixed=[f"@{c}" for c in ANCHORS],
                           k=0.02, iterations=80, weight="weight", seed=7)
    return {i: np.asarray(lay[i]) for i in nodes}


def layout_small(g, nodes, d):
    """Layout of one small component with median edge length d, centred at 0."""
    nodes = sorted(nodes)
    if len(nodes) == 2:
        return {nodes[0]: np.array([-d / 2, 0.0]), nodes[1]: np.array([d / 2, 0.0])}
    h = g.subgraph(nodes)
    lay = nx.kamada_kawai_layout(h) if len(nodes) <= 30 else nx.spring_layout(h, seed=7)
    xy = np.array([lay[i] for i in nodes])
    lengths = [np.linalg.norm(lay[a] - lay[b]) for a, b in h.edges()]
    xy = (xy - xy.mean(axis=0)) * (d / np.median(lengths))
    return dict(zip(nodes, xy))


def main():
    net = json.load(open(OUT / "network_edges.json"))
    prot = json.load(open(OUT / "proteins.json"))
    loc_of = dict(zip(prot["acc"], prot["loc"]))
    n = len(net["nodes"])

    g = nx.Graph()
    g.add_nodes_from(range(n))
    g.add_edges_from((e[0], e[1]) for e in net["edges"])
    comps = sorted(nx.connected_components(g), key=lambda c: (-len(c), min(c)))

    main_nodes = comps[0]
    pos = layout_main(g, main_nodes, loc_of, net["acc"])
    d = float(np.median([np.linalg.norm(pos[a] - pos[b]) for a, b in g.subgraph(main_nodes).edges()]))

    # arrange the remaining components on concentric rings around the main component
    main_xy = np.array(list(pos.values()))
    centre = main_xy.mean(axis=0)
    gap = GAP * d
    items = []
    for c in comps[1:]:
        sub = layout_small(g, c, d)
        ids, pts = list(sub), np.array(list(sub.values()))
        if len(pts) > 2:  # turn the long axis onto x so the component lies along the ring
            _, _, vt = np.linalg.svd(pts - pts.mean(axis=0))
            pts = (pts - pts.mean(axis=0)) @ vt.T
        items.append((ids, pts, np.ptp(pts[:, 0]), np.ptp(pts[:, 1])))
    radius = np.percentile(np.linalg.norm(main_xy - centre, axis=1), 99.5) + 2 * gap
    rings, ring, used = [], [], 0.0
    for it in items:
        need = it[2] + gap
        if ring and used + need > 2 * np.pi * radius:
            rings.append((radius, ring))
            radius += max(x[3] for x in ring) + 2 * gap
            ring, used = [], 0.0
        ring.append(it)
        used += need
    if ring:
        rings.append((radius, ring))
    for radius, ring in rings:
        spare = (2 * np.pi * radius - sum(x[2] + gap for x in ring)) / len(ring)
        theta = -np.pi / 2
        for ids, pts, w, _ in ring:
            arc = w + gap + spare
            t = theta + arc / (2 * radius)
            rot = np.array([[np.cos(t + np.pi / 2), -np.sin(t + np.pi / 2)],
                            [np.sin(t + np.pi / 2), np.cos(t + np.pi / 2)]])
            at = centre + radius * np.array([np.cos(t), np.sin(t)])
            for i, p in zip(ids, pts - pts.mean(axis=0)):
                pos[i] = at + rot @ p
            theta += arc / radius

    xy = np.array([pos[i] for i in range(n)])
    json.dump([[round(float(x), 4), round(float(y), 4)] for x, y in xy],
              open(OUT / "network_layout.json", "w"), separators=(",", ":"))
    print(f"layout written for {n} nodes: main component {len(main_nodes)}, "
          f"{len(comps) - 1} small components on {len(rings)} ring(s), edge length {d:.4f}")


if __name__ == "__main__":
    main()
