#!/usr/bin/env python3
"""Convert data/raw/ (Supplementary Tables S1-S5, sequences, complex models)
into the JSON files consumed by the website (data/processed/).

Outputs
-------
meta.json            summary counts, palettes, source codes
proteins.json        one record per cross-linked protein (columnar)
network_edges.json   PPI edges (original + augmented) on gene-symbol nodes
details/XX.json      per-protein details, sharded by accession hash
slims.json           Table S4 candidate motifs
contacts.json        Table S3 contact-site candidates
complexes/<name>.json + <name>.pdb   assembly models with cross-link distances
"""
import json
import re
import shutil
import zlib
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
TAB = RAW / "tables"
N_SHARDS = 64
XL_CUTOFF = 40.0  # Å, maximum Cα–Cα distance for DSBSO (Methods)
REF = RAW / "structures" / "reference"
# Yeast reference chain -> (yeast subunit, human counterpart gene); Supplementary Note 2
YEAST_REFERENCES = {
    "CORVET": {"pdb": "8QX8", "title": "Yeast CORVET (cryo-EM)", "rmsd": "table_2a_corvet_core_rmsd.csv",
               "chains": {"A": ("Vps11 (Pep5)", "VPS11"), "B": ("Vps16", "VPS16"), "C": ("Vps18 (Pep3)", "VPS18"),
                          "D": ("Vps33", "VPS33A"), "E": ("Vps3", "TGFBRAP1"), "F": ("Vps8", "VPS8")}},
    "HOPS": {"pdb": "7ZU0", "title": "Yeast HOPS (cryo-EM)", "rmsd": "table_2b_hops_core_rmsd.csv",
             "chains": {"A": ("Vps11 (Pep5)", "VPS11"), "B": ("Vps16", "VPS16"), "C": ("Vps18 (Pep3)", "VPS18"),
                        "D": ("Vps33", "VPS33A"), "E": ("Vps39 (Vam6)", "VPS39"), "F": ("Vps41", "VPS41")}},
}
RACK1_CHAIN_8GLP = "Sg"
RIBOSOME_CONTEXT = 25.0  # Å around RACK1 kept from the 40S (PDB 8GLP)

COMPARTMENTS = ["nucleus", "mitochondrion", "endoplasmic_reticulum", "golgi",
                "endosome", "lysosome", "peroxisome", "plasma_membrane"]
# Paul Tol "muted" (colour-blind safe), hue-matched to the Fig. 1A palette
# with the Hungarian algorithm so each organelle keeps a similar hue.
ORGANELLE_COLORS = {
    "nucleus": "#DDCC77", "mitochondrion": "#332288",
    "endoplasmic_reticulum": "#88CCEE", "golgi": "#117733",
    "lysosome": "#CC6677", "peroxisome": "#AA4499",
    "endosome": "#882255", "plasma_membrane": "#999933",
}
ORGANELLE_LABELS = {
    "nucleus": "Nucleus", "mitochondrion": "Mitochondrion",
    "endoplasmic_reticulum": "ER", "golgi": "Golgi", "endosome": "Endosome",
    "lysosome": "Lysosome", "peroxisome": "Peroxisome",
    "plasma_membrane": "Plasma membrane",
}
# Edge source bitmask
# 32 = DUC-XL-MS edge whose cell line could not be traced back to Table S1
SRC = {"HEK293": 1, "Jurkat": 2, "BioPlex": 4, "OpenCell": 8, "EndoMap": 16,
       "DUC-XL-MS": 32}

XL_RE = re.compile(r"(?:sp|tr)\|([^|]+)\|\S+ \((\d+)\)-(?:sp|tr)\|([^|]+)\|\S+ \((\d+)\)")
ENTRY_RE = re.compile(r"(?:sp|tr)\|([^|]+)\|([A-Z0-9]+)_HUMAN")
PPI_RE = re.compile(r"(?:sp|tr)\|([^|]+)\|[^-|]+-(?:sp|tr)\|([^|]+)\|")


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def records(df):
    return [{k: clean(v) for k, v in r.items()} for r in df.to_dict("records")]


def shard_of(acc):
    return zlib.crc32(acc.encode()) % N_SHARDS


def dump(obj, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"))


def read_fasta(path):
    seqs, gn = {}, {}
    acc, buf = None, []
    with open(path) as fh:
        for line in fh:
            if line.startswith(">"):
                if acc:
                    seqs[acc] = "".join(buf)
                parts = line[1:].split("|")
                acc = parts[1]
                m = re.search(r"GN=(\S+)", line)
                if m:
                    gn[acc] = m.group(1)
                buf = []
            else:
                buf.append(line.strip())
    if acc:
        seqs[acc] = "".join(buf)
    return seqs, gn


UP_RANGE = r"[<>?]?(\d+)\.\.[<>?]?(\d+)"


def read_uniprot_topology(path):
    """TRANSMEM / INTRAMEM / TOPO_DOM features from the pinned UniProt release."""
    import csv
    import gzip
    out = {}
    with gzip.open(path, "rt") as fh:
        for r in csv.DictReader(fh, delimiter="\t"):
            tm = [[int(a), int(b), n] for a, b, n in re.findall(
                r"TRANSMEM " + UP_RANGE + r'; /note="([^"]*)"', r["Transmembrane"])]
            intra = [[int(a), int(b)] for a, b in re.findall(r"INTRAMEM " + UP_RANGE, r["Intramembrane"])]
            dom = [[int(a), int(b), n] for a, b, n in re.findall(
                r"TOPO_DOM " + UP_RANGE + r'; /note="([^"]*)"', r["Topological domain"])]
            if tm or intra or dom:
                out[r["Entry"]] = {"len": int(r["Length"]), "tm": sorted(tm), "intra": sorted(intra),
                                   "dom": sorted(dom)}
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    seqs, fasta_gene = read_fasta(RAW / "sequences" / "LOP_DSBSO_target.fasta")
    up_topo = read_uniprot_topology(RAW / "sequences" / "uniprot_reviewed_human.tsv.gz")

    # ── Table S2: annotation of all cross-linked proteins + markers ──────────
    s2 = TAB / "Supplementary_Table_2_HEK_markers.xlsx"
    ann = pd.read_excel(s2, sheet_name="3. Crosslinked annotation")
    mk_org = pd.read_excel(s2, sheet_name="5. Markers (corrected)")
    mk_top = pd.read_excel(s2, sheet_name="7. Topology (corrected)")

    # ── Table S3: propagation, topology, contact sites ───────────────────────
    s3 = TAB / "Supplementary_Table_3_HEK_propagation_and_topology.xlsx"
    prop = pd.read_excel(s3, sheet_name="2. Organelle propagation")
    loops = pd.read_excel(s3, sheet_name="3. Membrane topology (loops)")
    tmprot = pd.read_excel(s3, sheet_name="4. Membrane topology (proteins)")
    contacts = pd.read_excel(s3, sheet_name="5. Contact-site candidates")

    # ── Table S4: SLiMs ──────────────────────────────────────────────────────
    s4 = TAB / "Supplementary_Table_4_SLiM_candidates.xlsx"
    slim = pd.read_excel(s4, sheet_name="Candidates")
    funnel = pd.read_excel(s4, sheet_name="Funnel")

    # ── Table S5: augmented interactome ──────────────────────────────────────
    s5 = TAB / "Supplementary_Table_5_augmented_core_interactome.xlsx"
    aug_hek = pd.read_excel(s5, sheet_name="HEK293_augmented_PPIs")
    aug = pd.read_excel(s5, sheet_name="HEK293_Jurkat_augmented_PPIs")

    # ── Table S1: residue pairs + PPIs ───────────────────────────────────────
    s1 = TAB / "Supplementary_Table_1_DUC-XL-MS_crosslinks.xlsx"
    rp = {c: pd.read_excel(s1, sheet_name=f"{c}_residue_pairs", usecols=[0, 3])
          for c in ("HEK293", "Jurkat")}
    ppi = {c: pd.read_excel(s1, sheet_name=f"{c}_PPIs", usecols=[0, 1, 2, 3, 4])
           for c in ("HEK293", "Jurkat")}
    # UniProt entry-name prefixes (e.g. HCLS1_HUMAN) for proteins absent from
    # the HEK293 search FASTA, including sameset/subset group members
    entry_gene = {}
    for df in ppi.values():
        for col in range(3):
            for v in df.iloc[:, col].dropna().astype(str):
                for acc, en in ENTRY_RE.findall(v):
                    entry_gene.setdefault(acc, en)

    # Protein universe and gene symbols
    gene = {}
    name = {}
    for r in ann.itertuples(index=False):
        gene[r[0]] = r[1] if isinstance(r[1], str) else fasta_gene.get(r[0], r[0])
        name[r[0]] = r[2] if isinstance(r[2], str) else ""

    # Residue pairs → per-protein lists
    xl = defaultdict(list)        # acc -> [partner, resSelf, resPartner, cellMask]
    pair_key = {}                 # (a, ra, b, rb) -> index into xl lists bookkeeping
    n_rp = {}
    for cell, df in rp.items():
        bit = SRC[cell]
        n = 0
        for lead in df.iloc[:, 0].astype(str):
            m = XL_RE.match(lead)
            if not m:
                continue
            a, ra, b, rb = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
            n += 1
            key = (a, ra, b, rb) if (a, ra) <= (b, rb) else (b, rb, a, ra)
            if key in pair_key:
                for ref in pair_key[key]:
                    ref[3] |= bit
                continue
            refs = []
            e1 = [b, ra, rb, bit]
            xl[a].append(e1)
            refs.append(e1)
            if a != b or ra != rb:
                e2 = [a, rb, ra, bit]
                if a != b:
                    xl[b].append(e2)
                    refs.append(e2)
            pair_key[key] = refs
            for p in (a, b):
                gene.setdefault(p, fasta_gene.get(p, p))
        n_rp[cell] = n
    del pair_key

    # Table S5 names proteins by gene symbol (or accession when no symbol);
    # match on every alias of an accession.
    alias_to_acc = {}
    for a in sorted(set(gene) | set(xl)) + sorted(set(fasta_gene) | set(entry_gene)):
        for al in (a, fasta_gene.get(a), gene.get(a), entry_gene.get(a)):
            if al:
                alias_to_acc.setdefault(al, a)
    for a in sorted(set(gene) | set(xl)):
        alias_to_acc[gene.get(a, a)] = a

    def aliases(a):
        return {x for x in (a, fasta_gene.get(a), gene.get(a), entry_gene.get(a)) if x}

    # PPI residue-pair counts per cell line (inter only), keyed by alias pair
    ppi_counts = defaultdict(lambda: [0, 0])
    n_ppi = {}
    for i, (cell, df) in enumerate(ppi.items()):
        inter = df[df.iloc[:, 3].astype(str).str.lower() == "inter"]
        n_ppi[cell] = len(inter)
        for lead, cnt in zip(inter.iloc[:, 0].astype(str), inter.iloc[:, 4]):
            m = PPI_RE.match(lead)
            if not m:
                continue
            if m.group(1) == m.group(2):
                continue
            pa, pb = m.group(1), m.group(2)
            for p in (pa, pb):
                if gene.get(p, p) == p and p in entry_gene:
                    gene[p] = fasta_gene.get(p, entry_gene[p])
            for ga in aliases(m.group(1)):
                for gb in aliases(m.group(2)):
                    k = tuple(sorted((ga, gb)))
                    ppi_counts[k][i] = max(ppi_counts[k][i], int(cnt))

    # Network edges from Table S5 (HEK293 + Jurkat augmented core interactome)
    hek_aug = {tuple(sorted((str(a), str(b)))) for a, b, s in
               aug_hek.iloc[:, :3].itertuples(index=False) if "original" not in str(s)}
    nodes, node_idx, edges = [], {}, []

    def nid(g):
        if g not in node_idx:
            node_idx[g] = len(nodes)
            nodes.append(g)
        return node_idx[g]

    unresolved = 0
    for a, b, src, common in aug.iloc[:, :4].itertuples(index=False):
        a, b = str(a), str(b)
        k = tuple(sorted((a, b)))
        mask = 0
        if "original" in str(src):
            c = ppi_counts.get(k, [0, 0])
            mask |= (SRC["HEK293"] if c[0] else 0) | (SRC["Jurkat"] if c[1] else 0)
            if mask == 0:
                unresolved += 1
                mask = SRC["DUC-XL-MS"]
        else:
            for s in str(src).split(";"):
                mask |= SRC.get(s.strip(), 0)
        c = ppi_counts.get(k, [0, 0])
        edges.append([nid(k[0]), nid(k[1]), mask, c[0], c[1],
                      str(common) if pd.notna(common) else "",
                      1 if k in hek_aug else 0])

    # Per-protein annotation
    prop_by = {r["Protein ID"]: r for r in records(prop)}
    mko = {r["Protein ID"]: r for r in records(mk_org)}
    mkt = {r["Protein ID"]: r for r in records(mk_top)}
    tm_by = {r["Protein ID"]: r for r in records(tmprot)}
    loops_by = defaultdict(list)
    for r in records(loops):
        loops_by[r["Protein ID"]].append(r)
    cs_by = {r["Protein ID"]: r for r in records(contacts)}
    slim_by = defaultdict(list)
    slim_recs = records(slim)
    for r in slim_recs:
        slim_by[str(r["Motif Protein ID"]).upper()].append(r)
    cc_by = {r["Protein ID"]: r.get("Subcellular Location (CC)") for r in records(ann)}

    node_acc = [alias_to_acc.get(g) for g in nodes]
    for a in node_acc:  # network-only proteins (group members) get a page too
        if a and a not in gene:
            gene[a] = fasta_gene.get(a, entry_gene.get(a, a))
    accs = sorted(set(gene) | set(xl))
    gene_to_acc = {g: a for g, a in alias_to_acc.items() if g != a}

    deg = defaultdict(lambda: [0, 0, 0])  # acc -> [hek, jurkat, augmented]
    for e in edges:
        for n in (e[0], e[1]):
            g = node_acc[n]
            if e[2] & 1:
                deg[g][0] += 1
            if e[2] & 2:
                deg[g][1] += 1
            if e[2] & 28 and not e[2] & 35:
                deg[g][2] += 1

    cols = {k: [] for k in ("acc", "gene", "name", "len", "loc", "tier", "src",
                            "cls", "pole", "tm", "topo", "slim", "cs", "dH", "dJ",
                            "dA", "nXL")}
    for a in accs:
        g = gene.get(a, a)
        p = prop_by.get(a, {})
        loc = p.get("Organelle Localization")
        t = tm_by.get(a, {})
        d = deg.get(a, [0, 0, 0])
        cols["acc"].append(a)
        cols["gene"].append(g)
        cols["name"].append(name.get(a, ""))
        cols["len"].append(len(seqs.get(a, "")) or None)
        cols["loc"].append(loc if p.get("Confidence Tier") in ("seed", "confident") else None)
        cols["tier"].append(p.get("Confidence Tier"))
        cols["src"].append(p.get("Annotation Source"))
        cols["cls"].append(p.get("Localization Class"))
        cols["pole"].append(mkt.get(a, {}).get("Topology Pole"))
        cols["tm"].append(t.get("TM Helix Count"))
        cols["topo"].append(t.get("Category"))
        cols["slim"].append(len(slim_by.get(a, [])))
        cols["cs"].append(cs_by.get(a, {}).get("Candidate Pool"))
        cols["dH"].append(d[0])
        cols["dJ"].append(d[1])
        cols["dA"].append(d[2])
        cols["nXL"].append(len(xl.get(a, [])))
    dump(cols, OUT / "proteins.json")
    dump({"nodes": nodes, "acc": node_acc, "edges": edges}, OUT / "network_edges.json")

    # Per-protein detail shards
    shards = defaultdict(dict)
    for a in accs:
        shards[shard_of(a)][a] = {
            "xl": xl.get(a, []),
            "prop": prop_by.get(a),
            "markerOrg": mko.get(a),
            "markerTopo": mkt.get(a),
            "cc": cc_by.get(a),
            "tm": tm_by.get(a),
            "loops": loops_by.get(a, []),
            "slims": slim_by.get(a, []),
            "contact": cs_by.get(a),
            "uniprot": up_topo.get(a),
        }
    if (OUT / "details").exists():
        shutil.rmtree(OUT / "details")
    for s, d in shards.items():
        dump(d, OUT / "details" / f"{s:02d}.json")

    dump(slim_recs, OUT / "slims.json")
    dump(records(contacts), OUT / "contacts.json")
    dump(records(tmprot), OUT / "topology.json")

    # Complexes
    cx_meta = []
    cdir = OUT / "complexes"
    cdir.mkdir(exist_ok=True)
    for c in ("CORVET", "HOPS", "Exocyst", "WASH"):
        src = RAW / "structures" / c
        chains = pd.read_csv(src / "chains.csv", encoding="utf-8-sig")
        dist = pd.read_csv(src / f"{c}_crosslink_distances.csv")
        pdb_chains = {l[21] for l in open(src / "complex.pdb") if l.startswith("ATOM")}
        chains = chains[chains["Chain"].isin(pdb_chains)]
        links = [[r.ChainA, int(r.ResidueA), r.ChainB, int(r.ResidueB),
                  round(float(r.distance), 2)] for r in dist.itertuples()]
        shutil.copyfile(src / "complex.pdb", cdir / f"{c}.pdb")
        sat = sum(1 for l in links if l[4] <= XL_CUTOFF)
        info = {"name": c, "chains": records(chains), "links": links,
                "cutoff": XL_CUTOFF}
        dump(info, cdir / f"{c}.json")
        cx_meta.append({"name": c, "nChains": len(chains), "nLinks": len(links),
                        "nSatisfied": sat, "genes": chains["Gene"].tolist()})

    reference = build_references(OUT / "reference")

    meta = {
        "counts": {
            "residuePairs": n_rp, "interPPIs": n_ppi,
            "proteinsCrosslinked": len(ann),
            "annotatedProteins": int(prop["Confidence Tier"].isin(["seed", "confident"]).sum()),
            "organelleMarkers": len(mk_org), "topologyMarkers": len(mk_top),
            "tmProteins": len(tmprot), "loops": len(loops),
            "slimCandidates": len(slim), "slimProteins": int(slim["Motif Protein ID"].str.upper().nunique()),
            "contactCandidates": len(contacts),
            "coreInteractome": len(aug),
            "hekAugmented": len(aug_hek),
        },
        "augSourcesHEK": aug_hek.iloc[:, 2].value_counts().to_dict(),
        "augSourcesAll": aug.iloc[:, 2].value_counts().to_dict(),
        "topologyCategories": loops["Agreement"].value_counts().to_dict(),
        "slimFunnel": records(funnel),
        "compartments": COMPARTMENTS,
        "organelleColors": ORGANELLE_COLORS,
        "organelleLabels": ORGANELLE_LABELS,
        "sourceBits": SRC,
        "nShards": N_SHARDS,
        "complexes": cx_meta,
        "reference": reference,
        "geneToAcc": {g: v for g, v in gene_to_acc.items()},
    }
    dump(meta, OUT / "meta.json")
    print(json.dumps(meta["counts"], indent=1))
    print("nodes", len(nodes), "edges", len(edges), "proteins", len(accs),
          "unresolved original edges", unresolved,
          "nodes without accession", sum(a is None for a in node_acc))


def build_references(out):
    """Experimental structures the paper compares against (secondary views)."""
    import csv
    from Bio.PDB import MMCIFIO, MMCIFParser, NeighborSearch, Select

    out.mkdir(parents=True, exist_ok=True)
    ident = {r["Subunit pair"]: float(r["Identity_%"])
             for r in csv.DictReader(open(REF / "table1_uniprot_identity.csv", encoding="utf-8-sig"))}
    ref = {"complexes": {}, "slims": {}}
    for cx, cfg in YEAST_REFERENCES.items():
        shutil.copyfile(REF / f"{cfg['pdb']}.cif", out / f"{cfg['pdb']}.cif")
        rows = []
        for r in csv.DictReader(open(REF / cfg["rmsd"], encoding="utf-8-sig")):
            pair = r["Subunit (yeast/human)"]
            rows.append({"pair": pair, "aligned": int(r["Aligned Cα pairs"]),
                         "rmsd": round(float(r["RMSD (Å)"]), 2), "identity": round(ident.get(pair, float("nan")), 1)})
        ref["complexes"][cx] = {"pdb": cfg["pdb"], "title": cfg["title"], "file": f"{cfg['pdb']}.cif",
                                "chains": {c: {"yeast": y, "human": h} for c, (y, h) in cfg["chains"].items()},
                                "core": rows}

    # RACK1 within the 40S (Fig. 4E): RACK1 plus the ribosome within RIBOSOME_CONTEXT Å
    parser = MMCIFParser(QUIET=True)
    st = parser.get_structure("8GLP", str(REF / "8GLP.cif"))
    rack1 = st[0][RACK1_CHAIN_8GLP]
    ns = NeighborSearch([a for a in st[0].get_atoms()])
    keep = set()
    for a in rack1.get_atoms():
        for b in ns.search(a.coord, RIBOSOME_CONTEXT):
            r = b.get_parent()
            keep.add((r.get_parent().id, r.id))

    class Near(Select):
        def accept_residue(self, r):
            return r.get_parent().id == RACK1_CHAIN_8GLP or (r.get_parent().id, r.id) in keep

    io = MMCIFIO()
    io.set_structure(st)
    io.save(str(out / "8GLP_RACK1.cif"), Near())
    groups = {}
    for r in csv.DictReader(open(REF / "RACK1_motif_contacts_6A.csv", encoding="utf-8-sig")):
        if r["partner"] in ("SHARED", "motif 1 only", "motif 2 only"):
            groups[r["partner"]] = [int(v) for v in r["rack1_contacts_6A"].split(";") if v]
    ref["slims"]["RACK1"] = {"pdb": "8GLP", "file": "8GLP_RACK1.cif", "chain": RACK1_CHAIN_8GLP,
                             "title": "RACK1 in the assembled human 40S subunit", "contextA": RIBOSOME_CONTEXT,
                             "contacts": {"both": groups.get("SHARED", []), "motif1": groups.get("motif 1 only", []),
                                          "motif2": groups.get("motif 2 only", [])}}

    # ERH·CIZ1 fusion crystal structure (Fig. 4F): ERH 1-104, linker, CIZ1 peptide; chain A only
    st = parser.get_structure("7X39", str(REF / "7X39.cif"))

    class ChainA(Select):
        def accept_chain(self, c):
            return c.id == "A"

    io = MMCIFIO()
    io.set_structure(st)
    io.save(str(out / "7X39_A.cif"), ChainA())
    ref["slims"]["ERH"] = {"pdb": "7X39", "file": "7X39_A.cif", "chain": "A",
                           "title": "ERH·CIZ1 crystal structure", "erhEnd": 104, "ciz1Start": 105,
                           "strand": [48, 54]}
    return ref


if __name__ == "__main__":
    main()
