/* DUC-XL-MS Atlas — page views. */
"use strict";
(function () {
  const { $, $$, esc, fmt, pct, views, viz } = App;
  const CHAIN_COLORS = ["#77AADD", "#EE8866", "#EEDD88", "#FFAABB", "#99DDFF", "#44BB99", "#BBCC33", "#AAAA00"];
  const SOURCE_COLORS = { orig: "#4477AA", OpenCell: "#EE7733", BioPlex: "#009988", EndoMap: "#CC3311", multi: "#BBBBBB" };
  const COMPLEX_INFO = {
    CORVET: "Hexameric endolysosomal tether: class C core (VPS11, VPS16, VPS18, VPS33A) plus CORVET-specific VPS3 (TGFBRAP1) and VPS8.",
    HOPS: "Homologous hexameric tether sharing the class C core with CORVET, distinguished by VPS39 and VPS41.",
    Exocyst: "Octameric tethering complex for polarized exocytosis; cross-link violations spread across subunits, consistent with a flexible architecture.",
    WASH: "Pentameric endosomal activator of Arp2/3; first full model of the human WASH complex. FKBP15 and ENTR1 are cross-link-supported accessory factors.",
  };
  const footer = () => `<div class="footer">DUC-XL-MS Atlas · Zhang et al. · Liu lab, FMP Berlin</div>`;
  const stat = (v, l, s = "") => `<div class="card stat"><div class="v num">${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const unmount = (fn) => { App.onLeave = fn; };
  const REF_NOTES = {
    Exocyst: "No experimental structure of the assembled human exocyst is used for comparison. The model agrees with a published EXOC4–EXOC5 dimer model (C-terminal EXOC4 loop at the interface) and with the Drosophila Rab11–Sec15 interface (EXOC6 α9 helix, residues 690–702).",
    WASH: "No experimental structure of the assembled WASH complex has been reported, and the complex is absent from budding yeast, so there is no reference structure for comparison.",
  };
  /* turn the longest extent of the structure to the horizontal axis before zooming */
  function faceLongAxis(v, sel = {}) {
    const atoms = v.selectedAtoms(sel); if (!atoms.length) return;
    const ext = ["x", "y", "z"].map((k) => { let lo = Infinity, hi = -Infinity; for (const a of atoms) { lo = Math.min(lo, a[k]); hi = Math.max(hi, a[k]); } return hi - lo; });
    const longest = ext.indexOf(Math.max(...ext));
    if (longest === 2) v.rotate(90, "y"); else if (longest === 1) v.rotate(90, "z");
    v.zoomTo(sel);
  }
  /* small secondary 3Dmol viewer for an experimental reference structure */
  async function refViewer(host, file, styleFn) {
    host.innerHTML = `<div class="loading">Loading structure…</div>`;
    const txt = await App.load(`reference/${file}`, "text");
    host.innerHTML = "";
    const v = $3Dmol.createViewer(host, { backgroundColor: App.cssVar("--surface") || "white" });
    v.addModel(txt, "cif");
    v.zoomTo(); styleFn(v); v.render();
    const ro = new ResizeObserver(() => { v.resize(); v.render(); }); ro.observe(host);
    const onTheme = () => { v.setBackgroundColor(App.cssVar("--surface")); v.render(); };
    window.addEventListener("themechange", onTheme);
    return () => { ro.disconnect(); window.removeEventListener("themechange", onTheme); v.clear(); };
  }
  const GH = "https://github.com/zhangzh-orange/DUC-XL-MS";
  const gh = (path, label) => `<a class="code-link" href="${GH}/blob/main/${path}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
  const rcsb = (id) => `<a href="https://www.rcsb.org/structure/${id}" target="_blank" rel="noopener">PDB ${id} ↗</a>`;

  /* ── home ─────────────────────────────────────────────────────────────── */
  views.home = async (el) => {
    const c = App.meta.counts;
    el.innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">HEK293 · Jurkat · in-cell cross-linking MS</div>
          <h1>Site-resolved spatial and structural interactome of a human cell</h1>
          <p class="lead">Differential ultracentrifugation combined with cross-linking mass spectrometry (DUC-XL-MS) maps where proteins sit, which side of the membrane they face, whom they touch directly — and through which residues.</p>
          <div class="hero-search">
            <input id="hero-q" type="search" placeholder="Search a gene or UniProt accession, e.g. LRBA" autocomplete="off" aria-label="Search protein">
            <div id="hero-suggest" class="suggest" hidden></div>
            <button class="btn primary" id="hero-go">Search</button>
          </div>
          <div class="examples">Examples:
            ${["LRBA", "STX7", "RAB7A", "RACK1", "ERH", "WASHC5", "ENTR1", "STT3B"].map((g) => {
              const a = App.resolve(g); return a ? `<a href="#/protein/${a}">${g}</a>` : "";
            }).join("")}
          </div>
        </div>
        <div class="card hero-map" id="hero-map" style="padding:0"></div>
      </section>
      <section class="grid g4" style="margin-bottom:16px">
        ${stat(fmt(c.residuePairs.HEK293), "residue-to-residue links", `HEK293 · plus ${fmt(c.residuePairs.Jurkat)} in Jurkat`)}
        ${stat(fmt(c.interPPIs.HEK293), "direct PPIs", `across ${fmt(c.proteinsCrosslinked)} proteins`)}
        ${stat(fmt(c.annotatedProteins), "proteins localized", `from ${fmt(2001)} curated organelle markers`)}
        ${stat(fmt(c.coreInteractome), "core interactome PPIs", "HEK293 + Jurkat, network-augmented")}
      </section>
      <section class="grid g3 pillars">
        <a class="card" href="#/organelles" style="color:inherit;text-decoration:none">
          <div class="eyebrow">Spatial</div><h2>Where proteins are</h2>
          <ul><li>${fmt(c.annotatedProteins)} proteins across 8 compartments</li><li>${fmt(c.loops)} loop sides in ${fmt(c.tmProteins)} TM proteins</li><li>${fmt(c.contactCandidates)} contact-site candidates</li></ul>
        </a>
        <a class="card" href="#/slims" style="color:inherit;text-decoration:none">
          <div class="eyebrow">Structural</div><h2>How they bind</h2>
          <ul><li>${fmt(c.slimCandidates)} candidate SLiMs in ${fmt(c.slimProteins)} proteins</li><li>Cross-link-restrained models of CORVET, HOPS, exocyst and WASH</li></ul>
        </a>
        <a class="card" href="#/systems" style="color:inherit;text-decoration:none">
          <div class="eyebrow">Systems</div><h2>How resources combine</h2>
          <ul><li>Triadic-closure augmentation with BioPlex 3.0, OpenCell and EndoMAP</li><li>${fmt(c.coreInteractome)} PPIs in the spatiostructural core</li></ul>
        </a>
      </section>
      ${footer()}`;
    App.wireSearch($("#hero-q"), $("#hero-suggest"));
    $("#hero-go").onclick = () => { const a = App.resolve($("#hero-q").value) ?? (App.search($("#hero-q").value)[0] != null ? App.P.acc[App.search($("#hero-q").value)[0]] : null); if (a) location.hash = `#/protein/${a}`; };
    const net = await App.network();
    const m = viz.cellMap($("#hero-map"), net, { edges: false });
    unmount(() => m.destroy());
  };

  /* ── protein ──────────────────────────────────────────────────────────── */
  views.protein = async (el, q) => {
    const acc = App.resolve(q);
    if (!acc) { el.innerHTML = `<div class="card"><h2>${esc(q)} is not in the DUC-XL-MS dataset</h2><p class="muted">Only cross-linked proteins (and proteins in the augmented core interactome) have pages.</p></div>`; return; }
    if (acc !== q) { location.replace(`#/protein/${acc}`); return; }
    const p = App.prot(acc);
    const [det, net] = await Promise.all([App.details(acc), App.network()]);
    const loc = App.locList(p.loc);

    // interactors: merge residue-level partners with network edges
    const part = new Map();
    const get = (a, gene) => {
      const k = a || "g:" + gene;
      if (!part.has(k)) { const i = a != null ? App.idx.byAcc.get(a) : null; part.set(k, { acc: a, gene: gene ?? App.geneOf(a), loc: App.locList(i != null ? App.P.loc[i] : null), mask: 0, rpH: 0, rpJ: 0, common: "", aug: false }); }
      return part.get(k);
    };
    for (const x of det?.xl || []) {
      if (x[0] === acc) continue;
      const r = get(x[0]);
      if (x[3] & 1) r.rpH++;
      if (x[3] & 2) r.rpJ++;
      r.mask |= x[3];
    }
    const ni = net.nodeOfAcc.get(acc);
    if (ni != null) for (const k of net.adj[ni]) {
      const e = net.edges[k], o = e[0] === ni ? e[1] : e[0];
      const r = get(net.acc[o], net.nodes[o]);
      r.mask |= e[2]; if (e[5]) r.common = e[5];
      if (!App.isOriginal(e[2])) r.aug = true;
    }
    const rows = [...part.values()].map((r) => ({ ...r, rp: r.rpH + r.rpJ }));
    const nIntraH = (det?.xl || []).filter((x) => x[0] === acc && x[3] & 1).length;
    const nInterH = (det?.xl || []).filter((x) => x[0] !== acc && x[3] & 1).length;
    const nAug = rows.filter((r) => !App.isOriginal(r.mask)).length;
    const pr = det?.prop || {};
    const mo = det?.markerOrg, mt = det?.markerTopo;
    // Table S3 stores per-compartment values in the order of the localization string
    const perComp = (v, f) => String(v).split(";").map((x, k) => `${loc[k] ? esc(App.orgLabel(loc[k])) + " " : ""}${esc(f(x))}`).join(" · ");
    const cxHits = (App.meta.complexes || []).filter((c) => c.genes?.includes(p.gene));

    el.innerHTML = `
      <div class="prot-head">
        <div><div class="eyebrow">Protein</div><h1>${esc(p.gene)}</h1></div>
        <div><div class="pname">${esc(p.name || "")}</div>
          <div class="small muted"><span class="mono">${esc(acc)}</span> · <a href="https://www.uniprot.org/uniprotkb/${esc(acc)}" target="_blank" rel="noopener">UniProt ↗</a> · <a href="#/network/${esc(acc)}">Show in network</a>${p.len ? ` · ${fmt(p.len)} aa` : ""}${cxHits.map((c) => ` · <a href="#/complex/${c.name}">${c.name} model</a>`).join("")}</div></div>
        <div class="chips" style="margin-left:auto">${App.orgChips(p.loc)}</div>
      </div>
      <section class="grid g4" style="margin-bottom:16px">
        ${stat(fmt(p.nXL), "residue pairs", `HEK293: ${fmt(nIntraH)} intra · ${fmt(nInterH)} inter`)}
        ${stat(fmt(rows.filter((r) => App.isOriginal(r.mask)).length), "direct partners", `HEK293 ${fmt(rows.filter((r) => r.mask & 1).length)} · Jurkat ${fmt(rows.filter((r) => r.mask & 2).length)}`)}
        ${stat(fmt(nAug), "augmented partners", "triadic closure with BioPlex / OpenCell / EndoMAP")}
        ${stat(fmt(det?.slims?.length || 0), "candidate SLiMs", det?.contact ? `contact-site candidate (${esc(det.contact["Candidate Pool"])})` : (p.tm ? `${p.tm} TM helices` : ""))}
      </section>
      <section class="grid g3" style="margin-bottom:16px">
        <div class="card">
          <h2>Localization</h2>
          <div class="card-sub">Graph-based propagation from curated organelle markers (Table S3)</div>
          <dl class="kv">
            <dt>Compartments</dt><dd>${loc.map(App.orgLabel).map(esc).join(" · ") || "Unassigned"}</dd>
            <dt>Evidence</dt><dd>${pr["Annotation Source"] === "marker_seed" ? "Organelle marker (seed)" : pr["Annotation Source"] === "propagation" ? "Propagated from cross-linked markers" : "—"}</dd>
            ${pr["Confidence Tier"] ? `<dt>Tier</dt><dd>${esc(pr["Confidence Tier"])} ${pr["Localization Class"] && pr["Localization Class"] !== "seed" ? `· ${esc(pr["Localization Class"])}` : ""}</dd>` : ""}
            ${pr["Vote Fraction"] != null ? `<dt>Vote fraction</dt><dd class="num">${perComp(pr["Vote Fraction"], (v) => (+v).toFixed(2))}</dd>` : ""}
            ${pr["Seeds per Compartment"] ? `<dt>Seed neighbours</dt><dd class="num">${perComp(pr["Seeds per Compartment"], (v) => v)}</dd>` : ""}
            ${mo?.Correction ? `<dt>Curation</dt><dd>${esc(mo.Correction)}${mo.Evidence ? ` — ${esc(mo.Evidence)}` : ""}</dd>` : ""}
            ${mt ? `<dt>Topology marker</dt><dd>${esc(mt["Topology Pole"])}${mt.Correction ? ` · ${esc(mt.Correction)}` : ""}</dd>` : ""}
          </dl>
          ${det?.cc ? `<div class="cc-text"><b>UniProt:</b> ${esc(String(det.cc).replace(/^SUBCELLULAR LOCATION:\s*/, "").replace(/\{[^}]*\}/g, "").replace(/\s+([;.,])/g, "$1").replace(/SUBCELLULAR LOCATION:\s*/g, ""))}</div>` : ""}
        </div>
        <div class="card span2">
          <h2>Interaction neighbourhood <span class="small muted">${rows.length > 70 ? "top 70 by residue pairs" : ""}</span></h2>
          <div class="card-sub">Node colour = partner compartment (ring = second compartment); solid edges are cross-linked (width ∝ residue pairs), dashed edges are augmented.</div>
          <div id="ego" style="max-width:560px;margin:0 auto"></div>
          <div class="legend">${App.meta.compartments.map((c) => `<span><span class="dot" style="background:${App.orgColor(c)};margin-right:5px"></span>${esc(App.orgLabel(c))}</span>`).join("")}<span><span class="dot" style="background:var(--aug);margin-right:5px"></span>Unassigned</span></div>
        </div>
      </section>
      ${det?.loops?.length ? `<section class="card" style="margin-bottom:16px">
        <h2>Membrane topology</h2>
        <div class="card-sub">${p.tm ? `${p.tm} UniProt-annotated TM helices (TRANSMEM) · ` : ""}domains between helices are named as in UniProt topology; their membrane side is assigned from cross-links to topology markers. Numbers are residue ranges.</div>
        <div id="topo"></div>
        <div class="legend">
          <span><span class="sw" style="background:var(--ok);height:5px"></span>DUC-XL-MS side, agrees with UniProt</span>
          <span><span class="sw" style="background:var(--accent);height:5px"></span>DUC-XL-MS side, not annotated in UniProt</span>
          <span><span class="sw" style="background:var(--bad);height:5px"></span>DUC-XL-MS side, conflicts with UniProt</span>
          <span><span class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 6px,transparent 6px 10px)"></span>UniProt side only (no cross-link evidence)</span>
          <span><span class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 2px,transparent 2px 6px)"></span>side inferred by alternation</span>
          <span><span class="dot" style="background:var(--ink-2);border-radius:2px;width:8px;height:14px"></span> TM helix (UniProt)</span>
          <span><b>N</b> / <b>C</b>: protein termini (residue 1 / last residue)</span>
        </div>
        ${det.tm?.["Inconsistent Flag"] ? `<p class="small tag-conflict" style="margin:8px 0 0">⚠ The assigned domain sides are not mutually consistent with the UniProt TM helices (dashed red helix: both flanking domains on the same side).</p>` : ""}
        <div id="topo-tbl" style="margin-top:12px"></div>
      </section>` : ""}
      <section class="card" style="margin-bottom:16px">
        <h2>Residue-level cross-link map
          <span class="toggles" id="cell-tg"><label><input type="checkbox" value="1" checked> HEK293</label><label><input type="checkbox" value="2" checked> Jurkat</label></span></h2>
        <div class="card-sub">Arcs above the sequence: intra-protein links. Ticks below: inter-protein links per lysine (height ∝ number of links). Bands: membrane loops (cyan = cytosolic, gold = other side) and candidate SLiMs (orange).</div>
        <div id="track" class="track-wrap"></div>
        <div class="legend">${[1, 2, 3].map((k) => `<span><span class="sw" style="background:${viz.CELL_COLORS[k]}"></span>${viz.CELL_LABELS[k]}</span>`).join("")}</div>
      </section>
      <section class="card" style="margin-bottom:16px">
        <h2>Interactors</h2>
        <div class="card-sub">Residue pairs counted from Table S1; sources from the augmented core interactome (Table S5).</div>
        <div id="int-tbl"></div>
      </section>
      ${det?.slims?.length ? `<section class="card" style="margin-bottom:16px"><h2>Candidate short linear motifs</h2><div class="card-sub">AlphaFold3 SLiM screen of cross-link-supported PPIs (Table S4)</div><div id="slim-tbl"></div></section>` : ""}
      ${footer()}`;

    App.bindTips(el);
    viz.ego($("#ego"), { gene: p.gene, loc }, rows, 70);
    if (det?.loops?.length) {
      const topo = viz.topology($("#topo"), det, p.len);
      const L = det.uniprot?.len || p.len;
      $("#topo-tbl").innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Domain</th><th class="num">Residues</th><th>DUC-XL-MS side</th><th>UniProt (TOPO_DOM)</th><th>Comparison</th><th class="num">Residue pairs</th><th class="num">Purity</th><th>Confidence</th></tr></thead><tbody>${
        det.loops.slice().sort((a, b) => viz.loopRange(a, L)[0] - viz.loopRange(b, L)[0]).map((l) => {
          const [a, b] = viz.loopRange(l, L);
          const reg = topo && topo.regs.find((r) => r.id === l["Loop ID"]);
          return `<tr><td>${esc(viz.regionName(l["Loop ID"]))}</td><td class="num">${a}–${b}</td><td>${esc(viz.SIDE_NAMES[l["Assigned Side"]] || l["Assigned Side"])}</td><td>${esc(reg?.upNote || "not annotated")}</td><td class="tag-${esc(l.Agreement)}">${esc(l.Agreement === "novel" ? "new assignment" : l.Agreement)}</td><td class="num">${fmt(l["Residue Pair Count"])}</td><td class="num">${l.Purity}</td><td>${esc(l.Confidence)}</td></tr>`;
        }).join("")}</tbody></table></div>`;
    }
    const drawTrack = () => {
      const m = $$("#cell-tg input").reduce((s, i) => s | (i.checked ? +i.value : 0), 0);
      viz.seqTrack($("#track"), acc, det, p.len, m || 3);
    };
    $$("#cell-tg input").forEach((i) => (i.onchange = drawTrack)); drawTrack();
    App.table($("#int-tbl"), rows, [
      { key: "gene", label: "Partner", render: (r) => App.protLink(r.acc, r.gene) },
      { key: "loc", label: "Compartment", value: (r) => r.loc.map(App.orgLabel).join("; "), render: (r) => r.loc.map((c) => `<span class="dot" style="background:${App.orgColor(c)}"></span> ${esc(App.orgLabel(c))}`).join(" ") || `<span class="muted">–</span>` },
      { key: "mask", label: "Sources", value: (r) => App.SRC_NAMES.filter((_, i) => r.mask & (1 << i)).join("; "), render: (r) => App.srcBadges(r.mask) },
      { key: "rpH", label: "Residue pairs HEK293", num: true },
      { key: "rpJ", label: "Residue pairs Jurkat", num: true },
      { key: "common", label: "Shared neighbours (augmented)", render: (r) => esc(r.common || "") },
    ], { sort: 3, name: `${p.gene}_interactors`, placeholder: "Filter partners…" });
    if (det?.slims?.length) App.table($("#slim-tbl"), det.slims, [
      { key: "Partner Gene Symbol", label: "Partner", render: (r) => App.protLink(String(r["Partner Protein ID"]).toUpperCase(), r["Partner Gene Symbol"]) },
      { key: "Start Residue", label: "Start", num: true }, { key: "End Residue", label: "End", num: true },
      { key: "Motif Sequence", label: "Sequence", render: (r) => `<span class="mono">${esc(r["Motif Sequence"])}</span>` },
      { key: "dpLDDT", label: "ΔpLDDT", num: true }, { key: "Max ipSAE", label: "max ipSAE", num: true },
      { key: "Cross-Link Count", label: "Cross-links", num: true },
    ], { sort: 4, name: `${p.gene}_slims` });
  };

  /* ── network ──────────────────────────────────────────────────────────── */
  views.network = async (el, focusAcc) => {
    const net = await App.network();
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Systems</div><h1>Interactome network</h1>
        <p>${fmt(net.edges.length)} PPIs among ${fmt(net.nodes.length)} proteins in the HEK293 + Jurkat core interactome, laid out around organelle anchors. Filter by evidence and compartment; click a protein to inspect its neighbourhood.</p></div>
      <div class="net-layout">
        <div class="card net-panel">
          <h3>Find protein</h3>
          <input type="search" id="net-q" placeholder="Gene symbol" style="width:100%">
          <h3>Edge evidence</h3>
          <div class="check-list" id="net-src">
            ${[[1, "DUC-XL-MS · HEK293"], [2, "DUC-XL-MS · Jurkat"], [32, "DUC-XL-MS · cell line unresolved"], [4, "Augmented · BioPlex 3.0"], [8, "Augmented · OpenCell"], [16, "Augmented · EndoMAP"]]
              .map(([b, l]) => `<label><input type="checkbox" value="${b}" checked> ${l}</label>`).join("")}
          </div>
          <h3>Minimum residue pairs</h3>
          <div class="range-row"><input type="range" id="net-rp" min="0" max="10" value="0"><span id="net-rp-v" class="num">0</span></div>
          <div class="small muted">Applies to cross-linked edges (augmented edges have none).</div>
          <h3>Compartment</h3>
          <select id="net-org" style="width:100%"><option value="">All compartments</option>${App.meta.compartments.map((c) => `<option value="${c}">${esc(App.orgLabel(c))}</option>`).join("")}<option value="__none">Unassigned only</option></select>
          <div class="legend" style="flex-direction:column;gap:4px;margin-top:12px">${App.meta.compartments.map((c) => `<span><span class="dot" style="background:${App.orgColor(c)};margin-right:6px"></span>${esc(App.orgLabel(c))}</span>`).join("")}<span><span class="dot" style="background:var(--aug);margin-right:6px"></span>Unassigned</span></div>
        </div>
        <div class="card net-canvas"><div id="sigma"></div><div class="net-count" id="net-count"></div><div class="net-hint">Scroll to zoom · drag to pan · click a node</div></div>
        <div class="card net-panel" id="net-side"><p class="muted">Select a protein to see its partners.</p></div>
      </div>`;

    const G = new graphology.Graph({ multi: false, type: "undirected" });
    const aug = App.cssVar("--aug") || "#a0a3aa";
    net.nodes.forEach((g, i) => {
      const loc = App.locList(App.nodeLoc(net, i));
      G.addNode(i, { x: net.xy[i][0], y: net.xy[i][1], label: g, size: 1.5 + Math.min(6, Math.log2(net.adj[i].length + 1) * 0.7), color: loc[0] ? App.meta.organelleColors[loc[0]] : aug, loc });
    });
    net.edges.forEach((e, k) => { if (!G.hasEdge(e[0], e[1])) G.addEdgeWithKey(k, e[0], e[1], { mask: e[2], rp: Math.max(e[3], e[4]), size: 0.4 }); });

    const st = { src: 63, rp: 0, org: "", sel: null, neigh: new Set(), q: null };
    const edgeOk = (a) => (a.mask & st.src) && (!App.isOriginal(a.mask) || a.rp >= st.rp || !(a.mask & 3));
    const nodeOk = (n, a) => !st.org || (st.org === "__none" ? !a.loc.length : a.loc.includes(st.org));
    const renderer = new Sigma(G, $("#sigma"), {
      labelRenderedSizeThreshold: 7, labelColor: { color: App.cssVar("--ink") }, defaultEdgeColor: App.cssVar("--edge"), zIndex: true,
      nodeReducer: (n, a) => {
        const r = { ...a };
        if (!nodeOk(n, a)) { r.hidden = true; return r; }
        if (st.sel != null) {
          if (+n === st.sel) { r.highlighted = true; r.zIndex = 2; r.size = a.size + 3; }
          else if (st.neigh.has(+n)) { r.zIndex = 1; r.forceLabel = st.neigh.size < 60; }
          else { r.color = App.cssVar("--grid"); r.label = ""; }
        }
        return r;
      },
      edgeReducer: (k, a) => {
        const r = { ...a };
        const [s, t] = G.extremities(k);
        if (!edgeOk(a) || !nodeOk(s, G.getNodeAttributes(s)) || !nodeOk(t, G.getNodeAttributes(t))) { r.hidden = true; return r; }
        if (!App.isOriginal(a.mask)) r.color = App.cssVar("--aug");
        if (st.sel != null) {
          if (+s === st.sel || +t === st.sel) { r.size = 1.2; r.color = App.isOriginal(a.mask) ? App.cssVar("--ink-2") : App.cssVar("--aug"); r.zIndex = 1; }
          else r.hidden = true;
        }
        return r;
      },
    });
    const count = () => {
      let ne = 0; G.forEachEdge((k, a, s, t) => { if (edgeOk(a) && nodeOk(s, G.getNodeAttributes(s)) && nodeOk(t, G.getNodeAttributes(t))) ne++; });
      $("#net-count").textContent = `${fmt(ne)} edges shown`;
    };
    const refresh = () => { renderer.refresh(); count(); };
    function select(i, zoom) {
      if (i != null && !nodeOk(i, G.getNodeAttributes(i))) { st.org = ""; $("#net-org").value = ""; }
      st.sel = i; st.neigh = new Set();
      if (i == null) { $("#net-side").innerHTML = `<p class="muted">Select a protein to see its partners.</p>`; refresh(); return; }
      G.forEachEdge(i, (k, a, s, t) => { if (edgeOk(a)) st.neigh.add(+s === i ? +t : +s); });
      const a = G.getNodeAttributes(i), acc = net.acc[i];
      const partners = [...st.neigh].map((o) => {
        const k = G.edge(i, o), ea = G.getEdgeAttributes(k);
        return { o, gene: net.nodes[o], mask: ea.mask, rp: ea.rp };
      }).sort((x, y) => y.rp - x.rp || x.gene.localeCompare(y.gene));
      $("#net-side").innerHTML = `
        <div class="eyebrow">Selected</div><h2 style="margin-bottom:4px">${esc(a.label)}</h2>
        <div class="chips" style="margin-bottom:10px">${App.orgChips(a.loc.join(";"))}</div>
        ${acc && App.idx.byAcc.has(acc) ? `<a class="btn small primary" href="#/protein/${esc(acc)}">Open protein page →</a>` : ""}
        <h3 style="margin-top:14px">${partners.length} partners shown</h3>
        <div style="display:flex;flex-direction:column;gap:3px;font-size:13px">${partners.slice(0, 150).map((p) => `<a href="javascript:void 0" data-n="${p.o}" style="display:flex;justify-content:space-between;gap:6px"><span>${esc(p.gene)}</span><span>${App.srcBadges(p.mask)}${p.rp ? `<span class="muted num"> ${p.rp}</span>` : ""}</span></a>`).join("")}</div>`;
      $$("#net-side [data-n]").forEach((l) => (l.onclick = () => select(+l.dataset.n, true)));
      refresh();
      if (zoom) {
        const d = renderer.getNodeDisplayData(i);
        if (d) renderer.getCamera().animate({ x: d.x, y: d.y, ratio: 0.25 }, { duration: 500 });
      }
    }
    renderer.on("clickNode", ({ node }) => select(+node));
    renderer.on("clickStage", () => select(null));
    renderer.on("enterNode", ({ node }) => { $("#sigma").style.cursor = "pointer"; });
    renderer.on("leaveNode", () => { $("#sigma").style.cursor = ""; });
    $$("#net-src input").forEach((c) => (c.onchange = () => { st.src = $$("#net-src input").reduce((s, i) => s | (i.checked ? +i.value : 0), 0); if (st.sel != null) select(st.sel); else refresh(); }));
    $("#net-rp").oninput = (e) => { st.rp = +e.target.value; $("#net-rp-v").textContent = st.rp; if (st.sel != null) select(st.sel); else refresh(); };
    $("#net-org").onchange = (e) => { st.org = e.target.value; refresh(); };
    $("#net-q").onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const acc = App.resolve(e.target.value);
      let i = acc != null ? net.nodeOfAcc.get(acc) : null;
      if (i == null) i = net.nodes.findIndex((g) => g.toUpperCase() === e.target.value.trim().toUpperCase());
      if (i != null && i >= 0) select(i, true); else e.target.setCustomValidity("Not in the network"), e.target.reportValidity(), setTimeout(() => e.target.setCustomValidity(""), 1500);
    };
    const onTheme = () => { renderer.setSetting("labelColor", { color: App.cssVar("--ink") }); renderer.setSetting("defaultEdgeColor", App.cssVar("--edge")); refresh(); };
    window.addEventListener("themechange", onTheme);
    unmount(() => { renderer.kill(); window.removeEventListener("themechange", onTheme); });
    count();
    if (focusAcc) { const i = net.nodeOfAcc.get(App.resolve(focusAcc)); if (i != null) setTimeout(() => select(i, true), 50); }
  };

  /* ── organelles ───────────────────────────────────────────────────────── */
  views.organelles = async (el) => {
    const P = App.P, comps = App.meta.compartments;
    const single = Object.fromEntries(comps.map((c) => [c, 0])), dual = Object.fromEntries(comps.map((c) => [c, 0]));
    const rows = [];
    P.acc.forEach((a, i) => {
      const l = App.locList(P.loc[i]); if (!l.length) return;
      l.forEach((c) => (l.length > 1 ? dual : single)[c]++);
      rows.push({ acc: a, gene: P.gene[i], name: P.name[i], loc: l, src: P.src[i], cls: P.cls[i], deg: P.dH[i] + P.dJ[i] });
    });
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Spatial</div><h1>Organelle map</h1>
        <p>Starting from ${fmt(2001)} curated organelle markers, labels were propagated one step along cross-link edges, annotating ${fmt(App.meta.counts.annotatedProteins)} proteins across eight compartments. Each dot is a protein; rings mark a second compartment.</p></div>
      <section class="grid g2" style="margin-bottom:16px">
        <div class="card" style="padding:0;height:560px" id="org-map"></div>
        <div class="card"><h2>Annotated proteins per compartment</h2><div class="card-sub">Single-compartment and dual-localized proteins (a dual protein counts in both)</div>
          <div id="org-bars"></div>
          <div class="legend"><span><span class="sw" style="background:var(--ink-2)"></span>single</span><span><span class="sw" style="background:var(--aug)"></span>dual-localized</span></div>
          <p class="note" style="margin-top:14px">Spatial consistency: 98.3% of marker–marker residue pairs connect the same or adjacent compartments, and 98.0% of topology-marker links lie on the same side of a membrane.</p>
        </div>
      </section>
      <section class="card"><h2>Localized proteins</h2><div id="org-tbl"></div></section>
      ${footer()}`;
    App.bindTips(el);
    const max = Math.max(...comps.map((c) => single[c] + dual[c]));
    $("#org-bars").innerHTML = comps.map((c) => `<div class="bar-row" data-tip="${esc(App.orgLabel(c))}: ${single[c]} single, ${dual[c]} dual">
      <span><span class="dot" style="background:${App.orgColor(c)};margin-right:6px"></span>${esc(App.orgLabel(c))}</span>
      <div class="bar-track" style="background:none"><div class="bar-fill" style="width:${(100 * single[c]) / max}%;background:${App.orgColor(c)};border-radius:0"></div><div class="bar-fill" style="width:${(100 * dual[c]) / max}%;background:${App.orgColor(c)};opacity:.4"></div></div>
      <span class="num" style="text-align:right">${fmt(single[c] + dual[c])}</span></div>`).join("");
    const t = App.table($("#org-tbl"), rows, [
      { key: "gene", label: "Gene", render: (r) => App.protLink(r.acc, r.gene) },
      { key: "acc", label: "UniProt", render: (r) => `<span class="mono">${esc(r.acc)}</span>` },
      { key: "loc", label: "Compartments", value: (r) => r.loc.map(App.orgLabel).join("; "), render: (r) => App.orgChips(r.loc.join(";")) },
      { key: "src", label: "Evidence", value: (r) => (r.src === "marker_seed" ? "marker" : "propagated") },
      { key: "cls", label: "Class" },
      { key: "deg", label: "Partners", num: true },
      { key: "name", label: "Protein name", wrap: true },
    ], { sort: 5, name: "organelle_annotation",
      tools: `<select id="org-f"><option value="">All compartments</option>${comps.map((c) => `<option value="${c}">${esc(App.orgLabel(c))}</option>`).join("")}<option value="__dual">Dual-localized</option></select>` });
    $("#org-f").onchange = (e) => { const v = e.target.value; t.setFilter(v ? (r) => (v === "__dual" ? r.loc.length > 1 : r.loc.includes(v)) : null); };
    const net = await App.network();
    const m = viz.cellMap($("#org-map"), net, { edges: false });
    unmount(() => m.destroy());
  };

  /* ── membrane topology ────────────────────────────────────────────────── */
  views.topology = async (el) => {
    const tm = (await App.load("topology")).map((r) => ({ acc: r["Protein ID"], ...r }));
    const tc = App.meta.topologyCategories;
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Spatial</div><h1>Membrane topology</h1>
        <p>Because the cross-linker spans less than a membrane, both lysines of a link lie on the same side. Using ${fmt(App.meta.counts.topologyMarkers)} topology markers, DUC-XL-MS assigns ${fmt(App.meta.counts.loops)} loops in ${fmt(App.meta.counts.tmProteins)} transmembrane proteins to a membrane side.</p></div>
      <section class="grid g2" style="margin-bottom:16px">
        <div class="card"><h2>Loop assignments vs UniProt</h2><div class="card-sub">Number of loops</div><div id="topo-stack"></div>
          <p class="small muted" style="margin-top:14px">Highlighted cases: <a href="#/protein/${App.resolve("LRBA")}">LRBA</a> (spurious TM annotation — both termini cytosolic), <a href="#/protein/${App.resolve("KTN1")}">KTN1</a> (C-terminus cytosolic, not luminal), <a href="#/protein/${App.resolve("STT3B")}">STT3B</a> (three mutually consistent loops).</p></div>
        <div class="card"><h2>Proteins by category</h2><div class="card-sub">validated = all assigned domains agree with UniProt; prediction = sides not annotated in UniProt; correction = at least one side conflicts with UniProt</div><div id="topo-cat"></div></div>
      </section>
      <section class="card"><h2>Transmembrane proteins</h2><div id="topo-tbl"></div></section>
      ${footer()}`;
    App.bindTips(el);
    viz.stack($("#topo-stack"), [
      { label: "Agree", value: tc.agree || 0, color: App.cssVar("--ok") },
      { label: "Novel", value: tc.novel || 0, color: App.cssVar("--accent") },
      { label: "Conflict", value: tc.conflict || 0, color: App.cssVar("--bad") }]);
    const cats = {}; tm.forEach((r) => (cats[r.Category] = (cats[r.Category] || 0) + 1));
    viz.bars($("#topo-cat"), Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: k === "validated" ? App.cssVar("--ok") : k === "correction" ? App.cssVar("--bad") : App.cssVar("--accent") })));
    App.table($("#topo-tbl"), tm, [
      { key: "Gene Symbol", label: "Gene", render: (r) => App.protLink(r.acc, r["Gene Symbol"]) },
      { key: "TM Helix Count", label: "TM helices", num: true },
      { key: "Loop Count", label: "Loops", num: true },
      { key: "Assigned Topology", label: "Assigned domain sides", wrap: true,
        text: (r) => String(r["Assigned Topology"] || "").split(";").map((x) => { const [id, sd] = x.trim().split(":"); return `${viz.regionName(id)}: ${viz.SIDE_NAMES[sd] || sd}`; }).join("; "),
        render: (r) => String(r["Assigned Topology"] || "").split(";").map((x) => { const [id, sd] = x.trim().split(":"); return `${esc(viz.regionName(id))}: <b>${esc(viz.SIDE_NAMES[sd] || sd)}</b>`; }).join("<br>") },
      { key: "Category", label: "Category", render: (r) => `<span class="tag-${r.Category === "validated" ? "agree" : r.Category === "correction" ? "conflict" : "novel"}">${esc(r.Category)}</span>` },
      { key: "Inconsistent Flag", label: "Inconsistent", render: (r) => (r["Inconsistent Flag"] ? `<span class="tag-conflict">yes</span>` : "") },
      { key: "Credible Correction", label: "Credible correction" },
      { key: "Protein Names", label: "Protein name", wrap: true, value: (r) => App.prot(r.acc || r["Protein ID"])?.name || r["Protein Names"] },
    ], { sort: 2, name: "membrane_topology" });
  };

  /* ── contact sites ────────────────────────────────────────────────────── */
  // "Ct:CYT; L2:IMS" (topology) or "endosome;golgi" (compartments) → readable phrases
  const locTopo = (v) => String(v || "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    if (x.includes(":")) { const [id, sd] = x.split(":"); return `${viz.regionName(id)}: ${viz.SIDE_NAMES[sd] || sd}`; }
    return App.orgLabel(x);
  });

  views.contacts = async (el) => {
    const rows = await App.load("contacts");
    const pools = {}; rows.forEach((r) => (pools[r["Candidate Pool"]] = (pools[r["Candidate Pool"]] || 0) + 1));
    const inDb = rows.filter((r) => r["In Database"] === "yes").length;
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Spatial</div><h1>Inter-organelle contact sites</h1>
        <p>Dual-localized proteins and transmembrane proteins with a resolved topology are candidates for organelle contacts. ${fmt(inDb)} of ${fmt(rows.length)} candidates are known trafficking (CORUM) or membrane-contact-site machinery.</p></div>
      <section class="grid g3" style="margin-bottom:16px">
        <div class="card"><h2>Candidate pools</h2><div id="cs-pool"></div></div>
        <div class="card span2"><h2>ER–mitochondria–endosome contacts</h2>
          <p class="small" style="margin:0 0 8px">Recovered tethers: <a href="#/protein/${App.resolve("RRBP1")}">RRBP1</a>–<a href="#/protein/${App.resolve("SYNJ2BP")}">SYNJ2BP</a>, <a href="#/protein/${App.resolve("VAPB")}">VAPB</a>–<a href="#/protein/${App.resolve("RMDN3")}">RMDN3</a>, the <a href="#/protein/${App.resolve("OSBP")}">OSBP</a>–VAP lipid-transfer bridge. <a href="#/protein/${App.resolve("RAB7A")}">RAB7A</a> links to the outer mitochondrial membrane (SYNJ2BP, TOMM70, VDAC1), endosomal SNAREs (STX7, STX12) and the ER (SEC22B).</p>
          <div id="cs-ego" style="max-width:460px;margin:0 auto"></div></div>
      </section>
      <section class="card"><h2>Contact-site candidates</h2><div id="cs-tbl"></div></section>${footer()}`;
    App.bindTips(el);
    viz.bars($("#cs-pool"), Object.entries(pools).map(([k, v]) => ({ label: k, value: v })));
    const t = App.table($("#cs-tbl"), rows, [
      { key: "Gene Symbol", label: "Gene", render: (r) => App.protLink(r["Protein ID"], r["Gene Symbol"]) },
      { key: "Candidate Pool", label: "Pool" },
      { key: "Localization/Topology", label: "Localization / topology", wrap: true, text: (r) => locTopo(r["Localization/Topology"]).join("; "), render: (r) => locTopo(r["Localization/Topology"]).map(esc).join("<br>") },
      { key: "In Database", label: "Known machinery" },
      { key: "Database Source", label: "Database", value: (r) => ({ trafficking: "CORUM trafficking", MCS: "MCS database", both: "CORUM + MCS" }[r["Database Source"]] || r["Database Source"]) },
      { key: "Protein Names", label: "Protein name", wrap: true, value: (r) => App.prot(r.acc || r["Protein ID"])?.name || r["Protein Names"] },
    ], { sort: 3, dir: -1, name: "contact_site_candidates",
      tools: `<select id="cs-f"><option value="">All pools</option>${Object.keys(pools).map((k) => `<option>${esc(k)}</option>`).join("")}</select>` });
    $("#cs-f").onchange = (e) => { const v = e.target.value; t.setFilter(v ? (r) => r["Candidate Pool"] === v : null); };
    // RAB7A neighbourhood restricted to the endomembrane / mitochondrial partners highlighted in Fig. 2F
    const rab = App.resolve("RAB7A");
    if (rab) {
      const det = await App.details(rab);
      const want = ["SYNJ2BP", "TOMM70", "VDAC1", "STX7", "STX12", "SEC22B"];
      const m = new Map();
      for (const x of det?.xl || []) {
        if (x[0] === rab) continue;
        const g = App.geneOf(x[0]); if (!want.includes(g)) continue;
        const r = m.get(g) || { acc: x[0], gene: g, loc: App.locList(App.prot(x[0])?.loc), mask: 0, rp: 0 };
        r.mask |= x[3]; r.rp++; m.set(g, r);
      }
      viz.ego($("#cs-ego"), { gene: "RAB7A", loc: App.locList(App.prot(rab)?.loc) }, [...m.values()]);
    }
  };

  /* ── SLiMs ────────────────────────────────────────────────────────────── */
  views.slims = async (el) => {
    const rows = await App.load("slims");
    // hub size = number of distinct motif-carrying proteins bound by the partner
    const hubSets = {}; rows.forEach((r) => (hubSets[r["Partner Gene Symbol"]] ??= new Set()).add(String(r["Motif Protein ID"]).toUpperCase()));
    const hubs = Object.fromEntries(Object.entries(hubSets).map(([g, v]) => [g, v.size]));
    const funnel = App.meta.slimFunnel;
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Structural</div><h1>Short linear motifs</h1>
        <p>An AlphaFold3 screen of cross-link-supported direct PPIs scored inter-chain contacts with ipSAE and kept segments that fold on binding (ΔpLDDT ≥ +18) within a disordered context (flank pLDDT &lt; 70): ${fmt(rows.length)} candidate motifs in ${fmt(App.meta.counts.slimProteins)} proteins at 44% sensitivity and 4.4% FDR.</p></div>
      <section class="grid g2" style="margin-bottom:16px">
        <div class="card"><h2>Screening funnel</h2><div class="card-sub">Steps 1–3 count protein pairs (blue), steps 4–6 count interface segments (orange); the last row counts distinct motif-carrying proteins.</div><div id="sl-funnel"></div></div>
        <div class="card"><h2>SLiM-binding hubs</h2><div class="card-sub">Partners bound by candidate motifs from the most distinct proteins</div><div id="sl-hubs"></div>
          <p class="small muted">New hubs absent from ELM: <a href="#/protein/${App.resolve("RACK1")}">RACK1</a> (S-[W/Y]-A-x-Φ and P-P-P-K motifs on one WD40 surface) and <a href="#/protein/${App.resolve("ERH")}">ERH</a> (β-strand augmentation at residues 48–54).</p></div>
      </section>
      <section class="grid g2" style="margin-bottom:16px">
        <div class="card"><h2>RACK1 binding surface <span class="small muted">${rcsb("8GLP")}</span></h2>
          <div class="card-sub">Reference: RACK1 (grey surface) in the assembled human 40S subunit; ribosome within 25 Å shown as pale cartoon. Residues contacted by predicted partner SLiMs (6 Å) are mapped onto the experimental structure.</div>
          <div class="card mol-view" id="ref-rack1" style="height:380px;box-shadow:none"></div>
          <div class="legend"><span><span class="dot" style="background:#228833;margin-right:5px"></span>both motif classes (13)</span><span><span class="dot" style="background:#AA3377;margin-right:5px"></span>motif 1 only, S-[W/Y]-A-x-Φ (9)</span><span><span class="dot" style="background:#EE7733;margin-right:5px"></span>motif 2 only, P-P-P-K (11)</span><span><span class="dot" style="background:#BBCCEE;margin-right:5px"></span>40S context</span></div></div>
        <div class="card"><h2>ERH β-strand augmentation <span class="small muted">${rcsb("7X39")}</span></h2>
          <div class="card-sub">Reference: ERH·CIZ1 crystal structure. ERH residues 48–54 lack an intramolecular β-partner and are bound by a cognate CIZ1 β-strand — the site where 8 of 10 predicted ERH binders dock.</div>
          <div class="card mol-view" id="ref-erh" style="height:380px;box-shadow:none"></div>
          <div class="legend"><span><span class="dot" style="background:#BBBBBB;margin-right:5px"></span>ERH</span><span><span class="dot" style="background:#EE7733;margin-right:5px"></span>ERH residues 48–54</span><span><span class="dot" style="background:#4477AA;margin-right:5px"></span>CIZ1 peptide</span></div></div>
      </section>
      <section class="card"><h2>Candidate motifs</h2><div id="sl-tbl"></div></section>
      ${footer()}`;
    App.bindTips(el);
    const R = App.meta.reference.slims, cleanups = [];
    unmount(() => cleanups.forEach((f) => f()));
    refViewer($("#ref-rack1"), R.RACK1.file, (v) => {
      const ch = R.RACK1.chain, k = R.RACK1.contacts;
      v.setStyle({}, { cartoon: { color: "#BBCCEE", opacity: 0.55 } });
      v.setStyle({ chain: ch }, { cartoon: { color: "#BBBBBB" } });
      const colorOf = Object.fromEntries([...k.both.map((r) => [r, "#228833"]), ...k.motif1.map((r) => [r, "#AA3377"]), ...k.motif2.map((r) => [r, "#EE7733"])]);
      v.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.95, colorfunc: (a) => colorOf[a.resi] || "#BBBBBB" }, { chain: ch });
      v.zoomTo({ chain: ch });
    }).then((f) => cleanups.push(f));
    refViewer($("#ref-erh"), R.ERH.file, (v) => {
      const e = R.ERH;
      v.setStyle({ resi: `1-${e.erhEnd}` }, { cartoon: { color: "#BBBBBB" } });
      v.setStyle({ resi: `${e.strand[0]}-${e.strand[1]}` }, { cartoon: { color: "#EE7733" }, stick: { color: "#EE7733", radius: 0.15 } });
      v.setStyle({ resi: `${e.ciz1Start}-999` }, { cartoon: { color: "#4477AA" }, stick: { color: "#4477AA", radius: 0.15 } });
      v.setStyle({ resi: "-5-0" }, {});
    }).then((f) => cleanups.push(f));
    const unit = (f) => (f.Step == null ? "proteins" : f.Step <= 3 ? "protein pairs" : "segments");
    viz.bars($("#sl-funnel"), funnel.map((f) => ({ label: `${f.Step != null ? f.Step + ". " : ""}${f.Description}`, value: +f.Count, color: f.Step == null ? "var(--muted)" : f.Step <= 3 ? "var(--accent)" : "#EE7733", tip: `${f.Description}: ${fmt(+f.Count)} ${unit(f)}` })));
    $$("#sl-funnel .bar-row").forEach((r) => (r.style.gridTemplateColumns = "minmax(0,1.3fr) 1fr 64px"));
    viz.bars($("#sl-hubs"), Object.entries(hubs).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g, v]) => ({ label: g, value: v, color: "#EE7733" })));
    App.table($("#sl-tbl"), rows, [
      { key: "Motif Gene Symbol", label: "Motif protein", render: (r) => App.protLink(String(r["Motif Protein ID"]).toUpperCase(), r["Motif Gene Symbol"]) },
      { key: "Partner Gene Symbol", label: "Partner", render: (r) => App.protLink(String(r["Partner Protein ID"]).toUpperCase(), r["Partner Gene Symbol"]) },
      { key: "Start Residue", label: "Start", num: true }, { key: "End Residue", label: "End", num: true },
      { key: "Motif Sequence", label: "Sequence", render: (r) => `<span class="mono">${esc(r["Motif Sequence"])}</span>` },
      { key: "Max ipSAE", label: "max ipSAE", num: true }, { key: "dpLDDT", label: "ΔpLDDT", num: true },
      { key: "Bound pLDDT", label: "Bound pLDDT", num: true },
      { key: "Cross-Link Count", label: "Cross-links", num: true },
    ], { sort: 5, name: "slim_candidates", placeholder: "Filter by gene, partner or sequence…" });
  };

  /* ── complexes ────────────────────────────────────────────────────────── */
  views.complexes = async (el) => {
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Structural</div><h1>Cross-link-restrained complex models</h1>
        <p>Cross-link-supported AF3x dimer models were assembled by Monte Carlo hierarchical assembly. Each model is checked against DUC-XL-MS cross-links using a 40 Å Cα–Cα limit.</p></div>
      <section class="grid g2 cx-cards">${App.meta.complexes.map((c) => `
        <a class="card" href="#/complex/${c.name}" style="color:inherit;text-decoration:none">
          <h2>${esc(c.name)} <span class="small muted">${c.nChains} subunits</span></h2>
          <p class="small" style="color:var(--ink-2);margin:0">${esc(COMPLEX_INFO[c.name] || "")}</p>
          <div class="meter"><div style="width:${(100 * c.nSatisfied) / c.nLinks}%;background:var(--sat)"></div><div style="flex:1;background:var(--viol)"></div></div>
          <div class="small muted">${c.nSatisfied} of ${c.nLinks} cross-links satisfied (${pct(c.nSatisfied, c.nLinks)})</div>
        </a>`).join("")}
      </section>
      <section class="card" style="margin-top:16px">
        <h2>Modelling pipeline: XL_MOPLC <a class="btn small" href="${GH}/tree/main/src/XL_MOPLC" target="_blank" rel="noopener">Code on GitHub ↗</a></h2>
        <div class="card-sub">XL-MS-guided Monte Carlo tree search for protein-complex assembly (MIT licence)</div>
        <img class="pipeline-fig" src="img/xl_moplc_pipeline.png" alt="XL_MOPLC pipeline. Panel A: local trimeric units from the cross-link network are predicted with AF3x under randomized cross-link restraints, split into dimers and reduced to a representative dimer library by pairwise-RMSD consensus. Panel B: Monte Carlo tree search from every root chain expands the assembly by SVD superposition, discards steric clashes, back-propagates scores with UCB and returns the globally highest-scoring complex." loading="lazy">
        <div class="grid g2" style="margin-top:14px">
          <div>
            <h3>How a model is built</h3>
            <ol style="padding-left:18px;margin:0;color:var(--ink-2)">
              <li>Build a PPI network from the cross-links and enumerate dimers and trimers (≥ 2 edges).</li>
              <li>Predict each unit with AlphaFold3 / AF3x, embedding cross-link restraints (non-redundant subsets, 3 samplings).</li>
              <li>Split trimers into dimers and keep the most central model per pair (lowest mean Cα RMSD).</li>
              <li>Run Monte Carlo tree search from every root chain, docking each new subunit by superposing the shared chain of a pre-computed dimer; assemblies with severe clashes (&gt; 50% of Cα within 5 Å) are discarded.</li>
              <li>Return the globally best-scoring model (<span class="mono">best_complex.pdb</span>).</li>
            </ol>
          </div>
          <div>
            <h3>Scoring</h3>
            <div class="formula">Score<sub>final</sub> = Score<sub>struct</sub> × Score<sub>XL</sub></div>
            <div class="formula">Score<sub>struct</sub> = Σ<sub>i&lt;j</sub> log<sub>10</sub>(n<sub>ij</sub> + 1) · mean pLDDT<sub>ij</sub></div>
            <div class="formula">Score<sub>XL</sub> = N<sub>XL</sub>(d<sub>Cα–Cα</sub> ≤ L) / N<sub>XL</sub><sup>total</sup></div>
            <div class="formula">UCB<sub>i</sub> = V̄<sub>i</sub> + 2√(ln N / n<sub>i</sub>)</div>
            <p class="small muted" style="margin:6px 0 0">n<sub>ij</sub>: Cβ–Cβ interface contacts between chains i and j (≤ 8 Å); pLDDT from the original AlphaFold prediction; L: maximum Cα–Cα distance of the cross-linker (40 Å here).</p>
          </div>
        </div>
      </section>${footer()}`;
  };

  views.complex = async (el, name) => {
    const info = await App.load(`complexes/${name}`);
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow"><a href="#/complexes">Complex models</a></div><h1>${esc(name)}</h1><p>${esc(COMPLEX_INFO[name] || "")}</p>
        <p class="small muted">Assembled with <a href="#/complexes">XL_MOPLC</a> (AF3x dimers + Monte Carlo tree search) · ${gh("src/XL_MOPLC", "pipeline code")}</p></div>
      <div class="mol-layout">
        <div class="card mol-view"><div id="mol"></div><div class="net-hint">Drag to rotate · scroll to zoom · click a row to focus a cross-link</div></div>
        <div class="card" style="overflow:auto;max-height:620px">
          <h3>Colour</h3>
          <div class="toggles"><label><input type="radio" name="cm" value="chain" checked> Subunit</label><label><input type="radio" name="cm" value="plddt"> pLDDT</label></div>
          <div id="mol-legend" class="legend" style="flex-direction:column;gap:3px"></div>
          <h3 style="margin-top:14px">Cross-links</h3>
          <div class="toggles"><label><input type="checkbox" id="x-sat" checked> satisfied ≤ ${info.cutoff} Å</label><label><input type="checkbox" id="x-viol" checked> violated</label><label><input type="checkbox" id="x-intra"> intra-subunit</label></div>
          <div class="legend"><span><span class="sw" style="background:#4477AA"></span>satisfied</span><span><span class="sw" style="background:#EE6677"></span>violated</span><span><span class="sw" style="background:#CCBB44"></span>selected in table</span></div>
          <div id="mol-sum" class="small muted" style="margin-top:6px"></div>
        </div>
      </div>
      <section class="grid g2" style="margin-top:16px" id="ref-sec"></section>
      <section class="card" style="margin-top:16px"><h2>Cross-link distances</h2><div id="mol-tbl"></div></section>${footer()}`;
    const chainGene = Object.fromEntries(info.chains.map((c) => [c.Chain, c.Gene]));
    const chainCol = Object.fromEntries(info.chains.map((c, i) => [c.Chain, CHAIN_COLORS[i % CHAIN_COLORS.length]]));
    const links = info.links.map(([ca, ra, cb, rb, d]) => ({ ca, ra, cb, rb, d, ga: chainGene[ca] || ca, gb: chainGene[cb] || cb, inter: ca !== cb, ok: d <= info.cutoff }));
    const nInter = links.filter((l) => l.inter), satInter = nInter.filter((l) => l.ok).length;
    $("#mol-sum").textContent = `${links.filter((l) => l.ok).length}/${links.length} satisfied overall · inter-subunit ${satInter}/${nInter.length}`;
    $("#mol").innerHTML = `<div class="loading">Loading model…</div>`;
    const pdb = await App.load(`complexes/${name}.pdb`, "text");
    $("#mol").innerHTML = "";
    const viewer = $3Dmol.createViewer($("#mol"), { backgroundColor: App.cssVar("--surface") || "white" });
    viewer.addModel(pdb, "pdb");
    const plddtColor = (b) => (b >= 90 ? "#0053D6" : b >= 70 ? "#65CBF3" : b >= 50 ? "#FFDB13" : "#FF7D45");
    let cylinders = [];
    function style() {
      const mode = $("input[name=cm]:checked").value;
      if (mode === "chain") {
        viewer.setStyle({}, {}); info.chains.forEach((c) => viewer.setStyle({ chain: c.Chain }, { cartoon: { color: chainCol[c.Chain], opacity: 0.92 } }));
        $("#mol-legend").innerHTML = info.chains.map((c) => `<span><span class="dot" style="background:${chainCol[c.Chain]};margin-right:6px"></span>${esc(c.Gene)} <span class="muted mono">chain ${esc(c.Chain)}</span>${c.Entry ? ` · ${App.protLink(c.Entry, "page")}` : ""}</span>`).join("");
      } else {
        viewer.setStyle({}, { cartoon: { colorfunc: (a) => plddtColor(a.b) } });
        $("#mol-legend").innerHTML = [["≥ 90", "#0053D6"], ["70–90", "#65CBF3"], ["50–70", "#FFDB13"], ["< 50", "#FF7D45"]].map(([l, c]) => `<span><span class="dot" style="background:${c};margin-right:6px"></span>pLDDT ${l}</span>`).join("");
      }
      drawLinks();
    }
    function drawLinks() {
      cylinders.forEach((c) => viewer.removeShape(c)); cylinders = [];
      const showSat = $("#x-sat").checked, showViol = $("#x-viol").checked, showIntra = $("#x-intra").checked;
      for (const l of links) {
        if ((!l.inter && !showIntra) || (l.ok && !showSat) || (!l.ok && !showViol)) continue;
        const a = viewer.selectedAtoms({ chain: l.ca, resi: l.ra, atom: "CA" })[0], b = viewer.selectedAtoms({ chain: l.cb, resi: l.rb, atom: "CA" })[0];
        if (!a || !b) continue;
        cylinders.push(viewer.addCylinder({ start: { x: a.x, y: a.y, z: a.z }, end: { x: b.x, y: b.y, z: b.z }, radius: 0.55, color: l.ok ? "#4477AA" : "#EE6677", fromCap: 1, toCap: 1, dashed: !l.ok }));
      }
      viewer.render();
    }
    $$("input[name=cm]").forEach((r) => (r.onchange = style));
    ["#x-sat", "#x-viol", "#x-intra"].forEach((s) => ($(s).onchange = drawLinks));
    style(); viewer.zoomTo(); faceLongAxis(viewer); viewer.render();
    App.table($("#mol-tbl"), links, [
      { key: "ga", label: "Subunit A", render: (r) => `${esc(r.ga)} <span class="muted mono">${r.ca}</span>` },
      { key: "ra", label: "Residue A", num: true },
      { key: "gb", label: "Subunit B", render: (r) => `${esc(r.gb)} <span class="muted mono">${r.cb}</span>` },
      { key: "rb", label: "Residue B", num: true },
      { key: "inter", label: "Type", value: (r) => (r.inter ? "inter" : "intra") },
      { key: "d", label: "Cα–Cα (Å)", num: true, render: (r) => r.d.toFixed(1) },
      { key: "ok", label: "Status", value: (r) => (r.ok ? "satisfied" : "violated"), render: (r) => (r.ok ? `<span style="color:#4477AA">● satisfied</span>` : `<span style="color:#EE6677">● violated</span>`) },
    ], { sort: 5, name: `${name}_crosslinks` });
    let focusCyl = null;  // highlighted cross-link (yellow), drawn even if its class is hidden
    $("#mol-tbl").addEventListener("click", (e) => {
      const tr = e.target.closest("tbody tr"); if (!tr) return;
      const num = (td) => +td.textContent.replace(/,/g, "");
      const cells = tr.children, ra = num(cells[1]), rb = num(cells[3]);
      const ca = cells[0].querySelector(".mono").textContent, cb = cells[2].querySelector(".mono").textContent;
      $(".mol-view").scrollIntoView({ behavior: "smooth", block: "center" });
      const pair = { or: [{ chain: ca, resi: ra }, { chain: cb, resi: rb }] };
      viewer.zoomTo({ within: { distance: 25, sel: pair } }, 600);
      viewer.removeAllLabels();
      if (focusCyl) viewer.removeShape(focusCyl);
      const fa = viewer.selectedAtoms({ chain: ca, resi: ra, atom: "CA" })[0], fb = viewer.selectedAtoms({ chain: cb, resi: rb, atom: "CA" })[0];
      if (fa && fb) focusCyl = viewer.addCylinder({ start: { x: fa.x, y: fa.y, z: fa.z }, end: { x: fb.x, y: fb.y, z: fb.z }, radius: 1.1, color: "#CCBB44", fromCap: 1, toCap: 1 });
      viewer.addLabel(`${chainGene[ca]} K${ra}`, { position: viewer.selectedAtoms({ chain: ca, resi: ra, atom: "CA" })[0], fontSize: 12, backgroundOpacity: 0.7 });
      viewer.addLabel(`${chainGene[cb]} K${rb}`, { position: viewer.selectedAtoms({ chain: cb, resi: rb, atom: "CA" })[0], fontSize: 12, backgroundOpacity: 0.7 });
      viewer.render();
    });
    const ro = new ResizeObserver(() => { viewer.resize(); viewer.render(); }); ro.observe($(".mol-view"));
    const onTheme = () => { viewer.setBackgroundColor(App.cssVar("--surface")); viewer.render(); };
    window.addEventListener("themechange", onTheme);
    let refCleanup = null;
    unmount(() => { ro.disconnect(); window.removeEventListener("themechange", onTheme); viewer.clear(); if (refCleanup) refCleanup(); });

    // secondary view: experimental reference structure compared in the paper
    const ref = App.meta.reference.complexes[name];
    if (!ref) {
      $("#ref-sec").innerHTML = `<div class="card span2"><h2>Reference structure</h2><p class="small" style="color:var(--ink-2);margin:0">${esc(REF_NOTES[name] || "No reference structure.")}</p></div>`;
      return;
    }
    const colOfGene = Object.fromEntries(info.chains.map((c) => [c.Gene, chainCol[c.Chain]]));
    $("#ref-sec").innerHTML = `
      <div class="card"><h2>${esc(ref.title)} <span class="small muted">${rcsb(ref.pdb)}</span></h2>
        <div class="card-sub">Experimental reference (Supplementary Note 2). Subunits use the colour of their human counterpart in the model above.</div>
        <div class="card mol-view" id="ref-mol" style="height:420px;box-shadow:none"></div></div>
      <div class="card"><h2>Model vs. ${esc(ref.pdb)}</h2>
        <div class="card-sub">Class C core subunits, TM-align of the human model against the yeast structure</div>
        <div id="ref-tbl"></div>
        <h3 style="margin-top:14px">Subunits</h3>
        <div class="legend" style="flex-direction:column;gap:3px">${Object.entries(ref.chains).map(([c, m]) => `<span><span class="dot" style="background:${colOfGene[m.human] || "var(--aug)"};margin-right:6px"></span>${esc(m.yeast)} <span class="muted mono">(yeast chain ${esc(c)})</span> ↔ ${esc(m.human)}</span>`).join("")}</div>
        <p class="small muted" style="margin-top:12px">The class C core arrangement (VPS11, VPS16, VPS18, VPS33A) of the human model reproduces the yeast structure, indicating conservation from yeast to human.</p></div>`;
    $("#ref-tbl").innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Subunit (yeast/human)</th><th class="num">Sequence identity</th><th class="num">Aligned Cα pairs</th><th class="num">RMSD (Å)</th></tr></thead><tbody>${ref.core.map((r) => `<tr><td>${esc(r.pair)}</td><td class="num">${r.identity}%</td><td class="num">${fmt(r.aligned)}</td><td class="num">${r.rmsd.toFixed(2)}</td></tr>`).join("")}</tbody></table></div>`;
    refCleanup = await refViewer($("#ref-mol"), ref.file, (v) => {
      v.setStyle({}, { cartoon: { color: "#BBBBBB", opacity: 0.8 } });
      for (const [c, m] of Object.entries(ref.chains)) v.setStyle({ chain: c }, { cartoon: { color: colOfGene[m.human] || "#BBBBBB" } });
      faceLongAxis(v);
    });
  };

  /* ── systems ──────────────────────────────────────────────────────────── */
  views.systems = async (el) => {
    const net = await App.network();
    const m = App.meta, segs = (src, origKey) => {
      const o = src[origKey] || 0, get = (k) => src[k] || 0;
      const multi = Object.entries(src).filter(([k]) => k.includes(";")).reduce((s, [, v]) => s + v, 0);
      return [
        { label: "DUC-XL-MS (cross-linked)", value: o, color: SOURCE_COLORS.orig },
        { label: "OpenCell", value: get("OpenCell"), color: SOURCE_COLORS.OpenCell },
        { label: "BioPlex 3.0", value: get("BioPlex"), color: SOURCE_COLORS.BioPlex },
        { label: "EndoMAP", value: get("EndoMap"), color: SOURCE_COLORS.EndoMap },
        { label: "Multiple resources", value: multi, color: SOURCE_COLORS.multi },
      ];
    };
    const augRows = net.edges.filter((e) => !App.isOriginal(e[2])).map((e) => ({ a: net.nodes[e[0]], b: net.nodes[e[1]], accA: net.acc[e[0]], accB: net.acc[e[1]], mask: e[2], common: e[5], hek: e[6] }));
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Systems</div><h1>Augmented spatiostructural core interactome</h1>
        <p>PPI resources built with different methods and cell lines overlap little. Triadic closure recovers missing edges: a pair absent from DUC-XL-MS but reported by EndoMAP, BioPlex 3.0 or OpenCell is added when both proteins share at least one direct DUC-XL-MS interactor. Augmented edges recover PDB-mappable PPIs at least as well as original edges.</p></div>
      <section class="grid g3" style="margin-bottom:16px">
        ${stat(fmt(m.counts.interPPIs.HEK293), "HEK293 cross-linked PPIs", "DUC-XL-MS, 1% FDR")}
        ${stat("+22.0%", "adding Jurkat DUC-XL-MS", "second cell line, comparable accuracy")}
        ${stat(fmt(m.counts.coreInteractome), "core interactome PPIs", "+55.4% after augmentation of the pooled network")}
      </section>
      <section class="grid g2" style="margin-bottom:16px">
        <div class="card"><h2>HEK293 network</h2><div class="card-sub">${fmt(m.counts.hekAugmented)} PPIs · sources of each edge</div><div id="sy-hek"></div></div>
        <div class="card"><h2>HEK293 + Jurkat core interactome</h2><div class="card-sub">${fmt(m.counts.coreInteractome)} PPIs · sources of each edge</div><div id="sy-all"></div></div>
      </section>
      <section class="card"><h2>Augmented edges</h2><div class="card-sub">Each edge lists the shared DUC-XL-MS neighbours that justify it.</div><div id="sy-tbl"></div></section>
      ${footer()}`;
    App.bindTips(el);
    viz.stack($("#sy-hek"), segs(m.augSourcesHEK, "DUC-XL-MS_original"));
    viz.stack($("#sy-all"), segs(m.augSourcesAll, "HEK293+Jurkat_original"));
    App.table($("#sy-tbl"), augRows, [
      { key: "a", label: "Protein A", render: (r) => App.protLink(r.accA, r.a) },
      { key: "b", label: "Protein B", render: (r) => App.protLink(r.accB, r.b) },
      { key: "mask", label: "Reported by", value: (r) => App.SRC_NAMES.filter((_, i) => r.mask & (1 << i)).join("; "), render: (r) => App.srcBadges(r.mask) },
      { key: "common", label: "Shared DUC-XL-MS neighbours", wrap: true },
      { key: "hek", label: "In HEK293-only augmentation", value: (r) => (r.hek ? "yes" : "no") },
    ], { name: "augmented_edges", placeholder: "Filter by gene or resource…" });
  };

  /* ── about ────────────────────────────────────────────────────────────── */
  views.about = async (el) => {
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">About</div><h1>About this resource</h1></div>
      <section class="grid g2">
        <div class="card"><h2>Study</h2>
          <p><b>Site-resolved spatial and structural interactome of a human cell.</b><br>Zehong Zhang, Nanako Yokoyama, Ying Zhu, Julia Ruta, Jiale Cheng, Vini Natalia, Tolga Soykan, Volker Haucke, Fan Liu. Leibniz-Forschungsinstitut für Molekulare Pharmakologie (FMP), Berlin. Correspondence: Fan Liu.</p>
</div>
        <div class="card"><h2>Data shown</h2>
          <dl class="kv">
            <dt>Table S1</dt><dd>Cross-linked residue pairs and PPIs (HEK293, Jurkat; 1% FDR, residue-pair level)</dd>
            <dt>Table S2</dt><dd>Organelle and topology markers with manual curation</dd>
            <dt>Table S3</dt><dd>Localization propagation, membrane-loop topology, contact-site candidates</dd>
            <dt>Table S4</dt><dd>AlphaFold3 short-linear-motif candidates</dd>
            <dt>Table S5</dt><dd>Triadic-closure augmented core interactome</dd>
            <dt>Models</dt><dd>CORVET, HOPS, exocyst and WASH assemblies with cross-link distances (40 Å Cα–Cα)</dd>
          </dl></div>
        <div class="card"><h2>Reading the views</h2>
          <ul style="padding-left:18px;margin:0;color:var(--ink-2)">
            <li>Organelle colours use Paul Tol's colour-blind-safe "muted" scheme; every colour is also named in a legend or label.</li>
            <li>Network edges: solid = cross-linked in DUC-XL-MS; grey/dashed = augmented from another resource.</li>
            <li>620 DUC-XL-MS edges in Table S5 could not be traced to a cell line by gene symbol and are labelled “DUC-XL-MS”.</li>
          </ul></div>
        <div class="card"><h2>Code &amp; data</h2>
          <dl class="kv">
            <dt>GitHub</dt><dd><a href="${GH}" target="_blank" rel="noopener">zhangzh-orange/DUC-XL-MS ↗</a> — figure-reproduction notebooks, the XL_MOPLC assembly pipeline and analysis modules (organelle-label propagation, membrane-topology assignment, ipSAE SLiM screen, triadic-closure augmentation). MIT licence.</dd>
            <dt>PRIDE</dt><dd>HEK293 <span class="mono">PXD081158</span> · Jurkat <span class="mono">PXD081113</span> (ProteomeXchange)</dd>
            <dt>Figures</dt><dd>${gh("src/figures", "src/figures/")} — Fig. 1, 2, 4, 7 notebooks; Fig. 3 and 6 imaging superplots in R</dd>
            <dt>Code questions</dt><dd><a href="${GH}/issues" target="_blank" rel="noopener">GitHub issues ↗</a></dd>
          </dl>
          <h3 style="margin-top:12px">Citation</h3>
<pre class="bib">@article{zhang2026ducxlms,
  title  = {Site-resolved spatial and structural interactome of a human cell},
  author = {Zhang, Zehong and Yokoyama, Nanako and Zhu, Ying and Ruta, Julia and
            Cheng, Jiale and Natalia, Vini and Soykan, Tolga and Haucke, Volker and Liu, Fan},
  year   = {2026}
}</pre></div>
        <div class="card"><h2>Related resources</h2>
          <p><a href="https://opencell.sf.czbiohub.org/" target="_blank" rel="noopener">OpenCell ↗</a> · <a href="https://endomap.hms.harvard.edu/network" target="_blank" rel="noopener">EndoMAP ↗</a> · <a href="https://bioplex.hms.harvard.edu/" target="_blank" rel="noopener">BioPlex ↗</a> · <a href="http://elm.eu.org/" target="_blank" rel="noopener">ELM ↗</a></p></div>
      </section>${footer()}`;
  };
})();
