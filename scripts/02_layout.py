#!/usr/bin/env python3
"""ForceAtlas2 (LinLog mode) layout of the core interactome.

The largest connected component is laid out with ForceAtlas2 in LinLog mode, starting
from a spring layout, with edges weighted by the square root of their residue pairs
(augmented edges count as one), so tightly cross-linked assemblies gather into clusters.
Small disconnected components (pairs, triplets, ...) are laid out one by one and placed
on a ring around the main component.
Louvain groups of the main component (on the same weights) are named after their three most
connected proteins; the small components form one further group.
Writes data/processed/network_layout.json: [[x, y], ...] in node order, and
data/processed/network_groups.json: {"of": group per node, "groups": [...]}.
`--groups-only` recomputes the groups on the existing layout (the layout takes minutes).
"""
import json
import math
import sys
from pathlib import Path

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed"
ITERATIONS = 600
SEED = 1
RESOLUTION = 1.5  # Louvain resolution


def layout_main(g, nodes):
    """ForceAtlas2 LinLog layout of the main component, scaled to [-1, 1]."""
    h = g.subgraph(nodes)
    init = nx.spring_layout(h, k=1.2 / math.sqrt(len(nodes)), iterations=60, seed=SEED)
    scaled = {n: np.array(p) * 100 for n, p in init.items()}
    pos = nx.forceatlas2_layout(h, pos=scaled, max_iter=ITERATIONS, scaling_ratio=4.0, gravity=0.6,
                                linlog=True, weight="weight", seed=SEED)
    xy = np.array([pos[n] for n in nodes], dtype=float)
    if not np.isfinite(xy).all():  # fall back to the spring layout
        xy = np.array([init[n] for n in nodes], dtype=float)
    c = xy.mean(axis=0)
    s = np.abs(xy - c).max() or 1.0
    return {n: (p - c) / s for n, p in zip(nodes, xy)}


def groups(g, comps, nodes, xy):
    """Louvain groups of the main component plus one group of all small components."""
    main_nodes = comps[0]
    cs = sorted(nx.community.louvain_communities(g.subgraph(main_nodes), weight="weight", resolution=RESOLUTION, seed=SEED),
                key=lambda c: (-len(c), min(c)))
    members = [sorted(c) for c in cs] + [sorted(set().union(*comps[1:]))] if len(comps) > 1 else [sorted(c) for c in cs]
    of = [0] * len(nodes)
    out = []
    for gi, m in enumerate(members):
        for i in m:
            of[i] = gi
        small = gi == len(cs)
        sub = g.subgraph(m)
        top = sorted(m, key=lambda i: (-sub.degree(i, weight="weight"), nodes[i]))[:3]
        pts = np.array([xy[i] for i in m])
        out.append({"id": gi, "label": "Small separate groups" if small else " / ".join(nodes[i] for i in top),
                    "kind": "s" if small else "c", "count": len(m), "ppis": sub.number_of_edges(),
                    "x": round(float(np.median(pts[:, 0])), 4), "y": round(float(np.median(pts[:, 1])), 4)})
    return {"of": of, "groups": out}


def main():
    net = json.load(open(OUT / "network_edges.json"))
    n = len(net["nodes"])

    g = nx.Graph()
    g.add_nodes_from(range(n))
    for e in net["edges"]:
        g.add_edge(e[0], e[1], weight=math.sqrt(max(1, e[3] + e[4])))
    comps = sorted(nx.connected_components(g), key=lambda c: (-len(c), min(c)))

    main_nodes = sorted(comps[0])
    if "--groups-only" in sys.argv:
        old = json.load(open(OUT / "network_layout.json"))
        res = groups(g, comps, net["nodes"], old)
        json.dump(res, open(OUT / "network_groups.json", "w"), separators=(",", ":"))
        print(f"{len(res['groups'])} groups written")
        return
    pos = layout_main(g, main_nodes)

    # small components on a ring around the main component
    small = [sorted(c) for c in comps[1:]]
    sizes = [0.014 + 0.006 * math.sqrt(len(c)) for c in small]
    R = max(1.2, sum(2.4 * sz + 0.012 for sz in sizes) / (2 * math.pi) + 0.03)
    ang = 0.0
    for comp, sz in zip(small, sizes):
        sp = nx.spring_layout(g.subgraph(comp), seed=SEED)
        cx, cy = R * math.cos(ang), R * math.sin(ang)
        for i, p in sp.items():
            pos[i] = np.array([cx + p[0] * sz, cy + p[1] * sz])
        ang += (2.4 * sz + 0.012) / R

    xy = np.array([pos[i] for i in range(n)])
    json.dump([[round(float(x), 4), round(float(y), 4)] for x, y in xy],
              open(OUT / "network_layout.json", "w"), separators=(",", ":"))
    res = groups(g, comps, net["nodes"], xy.tolist())
    json.dump(res, open(OUT / "network_groups.json", "w"), separators=(",", ":"))
    print(f"layout written for {n} nodes: main component {len(main_nodes)} (ForceAtlas2 LinLog), "
          f"{len(small)} small components on a ring of radius {R:.2f}, {len(res['groups'])} groups")


if __name__ == "__main__":
    main()
