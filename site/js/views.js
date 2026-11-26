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
  const HERO_EXAMPLE = "LRBA";
  views.home = async (el) => {
    const c = App.meta.counts;
    const exAcc = App.resolve(HERO_EXAMPLE);
    el.innerHTML = `
      <section class="hero">
        <div>
          <h1>Site-resolved spatial and structural interactome of a human cell</h1>
          <div class="hero-search">
            <input id="hero-q" type="search" placeholder="Search a gene or UniProt accession, e.g. LRBA" autocomplete="off" aria-label="Search protein">
            <div id="hero-suggest" class="suggest" hidden></div>
            <button class="btn primary" id="hero-go">Search</button>
          </div>
          <div class="examples">Examples:
            ${["LRBA", "RAB7A", "RACK1", "WASHC5", "STT3B"].map((g) => {
              const a = App.resolve(g); return a ? `<a href="#/protein/${a}">${g}</a>` : "";
            }).join("")}
            · <a href="#/new"><b>★ All new findings</b></a>
          </div>
        </div>
        <div class="card hero-imap">
          <div class="eyebrow" style="color:var(--accent)"><span class="ex-badge">Example</span> interface map of ${HERO_EXAMPLE}</div>
          <div id="hero-imap"><div class="loading">Loading…</div></div>
          <div class="cap">Each row is one partner; hover a row to see which residues link. <a href="#/protein/${exAcc}">Open ${HERO_EXAMPLE} →</a></div>
        </div>
      </section>

      <h2 class="home-h">One cross-linking experiment, five readouts</h2>
      <section class="method" style="margin-bottom:30px">
        <div class="readouts">
          <a href="#/proteins"><span class="rv num">${fmt(c.interPPIs.HEK293)}</span><b>Binding interfaces</b><span>direct PPIs with the site on both proteins</span></a>
          <a href="#/organelles"><span class="rv num">${fmt(c.annotatedProteins)}</span><b>Localization</b><span>proteins placed in 8 compartments</span></a>
          <a href="#/topology"><span class="rv num">${fmt(c.loops)}</span><b>Membrane topology</b><span>loop sides in ${fmt(c.tmProteins)} TM proteins</span></a>
          <a href="#/contacts"><span class="rv num">${fmt(c.contactCandidates)}</span><b>Contact sites</b><span>inter-organelle candidates</span></a>
          <a href="#/slims"><span class="rv num">${fmt(c.slimCandidates)}</span><b>Structure</b><span>candidate SLiMs and a complex structure pipeline</span></a>
        </div>
      </section>

      <h2 class="home-h">New beyond UniProt and existing databases <a class="small" href="#/new">see all →</a></h2>
      <section class="grid g4 new-tiles" style="margin-bottom:30px">
        <a class="card stat" href="#/new?s=loc"><div class="v num">${fmt(c.newLoc)}</div><div class="l">new protein localizations <span class="nb">NEW</span></div></a>
        <a class="card stat" href="#/new?s=topo"><div class="v num">${fmt(c.novelLoops)}</div><div class="l">new membrane-loop sides <span class="nb">NEW</span></div></a>
        <a class="card stat" href="#/new?s=slim"><div class="v num">${fmt(c.slimCandidates)}</div><div class="l">candidate short linear motifs <span class="nb">NEW</span></div></a>
        <a class="card stat" href="#/new?s=contact"><div class="v num">${fmt(c.newContacts)}</div><div class="l">contact-site candidates not in databases <span class="nb">NEW</span></div></a>
      </section>

      <h2 class="home-h">How DUC-XL-MS complements existing interactome resources</h2>
      <section style="margin-bottom:30px">
        <div class="cmp-wrap"><table class="cmp">
          <colgroup><col style="width:14%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:18%"></colgroup>
          <thead><tr><th></th><th>AP-MS interactome<br><span class="small"><a href="https://bioplex.hms.harvard.edu/" target="_blank" rel="noopener">BioPlex ↗</a></span></th><th>AP-MS interactome<br><span class="small"><a href="https://opencell.czbiohub.org/" target="_blank" rel="noopener">OpenCell ↗</a></span></th><th>Association database<br><span class="small"><a href="https://string-db.org/" target="_blank" rel="noopener">STRING ↗</a></span></th><th>Endosome XL-MS interactome<br><span class="small"><a href="https://endomap.hms.harvard.edu/" target="_blank" rel="noopener">EndoMAP ↗</a></span></th><th class="us">DUC-XL-MS Atlas<br><span class="small">this study</span></th></tr></thead>
          <tbody>
            <tr><th scope="row">Measurement</th><td>Co-purification with an overexpressed tagged bait</td><td>Co-purification with an endogenously tagged bait</td><td>Integrated association scores</td><td>Cross-linking after endosome enrichment</td><td class="us">Cross-linking of whole-cell lysate, before fractionation</td></tr>
            <tr><th scope="row">Direct contact</th><td><span class="no">Not resolved</span> — direct and indirect complex members</td><td><span class="no">Not resolved</span> — direct and indirect complex members</td><td><span class="no">Not resolved</span> — functional association, not necessarily physical</td><td><span class="yes">Yes</span></td><td class="us"><span class="yes">Yes</span> — the two residues lie within cross-linker reach</td></tr>
            <tr><th scope="row">Binding site</th><td><span class="no">No</span></td><td><span class="no">No</span></td><td><span class="no">No</span></td><td><span class="yes">Yes</span> — residue on both proteins</td><td class="us"><span class="yes">Yes</span> — residue on both proteins, for every link</td></tr>
            <tr><th scope="row">Scale</th><td>Whole cell<br><span class="small muted">HEK293T, HCT116</span></td><td>Whole cell<br><span class="small muted">HEK293T</span></td><td><span class="no">Not cell-specific</span> — integrated across sources and organisms</td><td>Single organelle<br><span class="small muted">early endosomes, HEK293</span></td><td class="us">Whole cell<br>HEK293: ${fmt(c.residuePairs.HEK293)} residue pairs, ${fmt(c.interPPIs.HEK293)} PPIs<br>Jurkat: ${fmt(c.residuePairs.Jurkat)} residue pairs, ${fmt(c.interPPIs.Jurkat)} PPIs</td></tr>
            <tr><th scope="row">Weak, transient contacts</th><td>Often lost during lysis and purification</td><td>Often lost during lysis and purification</td><td>Only where previously reported</td><td>Cytosol-facing endosomal machinery partly lost during endosome enrichment</td><td class="us">Preserved: cross-linking before any purification</td></tr>
            <tr><th scope="row">Additional readouts</th><td><span class="no">None</span></td><td>Protein localization by live-cell imaging</td><td><span class="no">None</span></td><td>Structural models of endosomal complexes</td><td class="us">Organelle localization, membrane side of loops, contact sites, structural restraints</td></tr>
          </tbody></table></div>
        <p class="small muted" style="margin:10px 0 0">The approaches are complementary: they share a common core of PPIs, PPI overlap between datasets is low even for the same method, and AP-MS is more sensitive for low-abundance interactors. See <a href="#/systems">Systems</a> for the overlap and the augmented core interactome.</p>
      </section>
      ${footer()}`;
    App.wireSearch($("#hero-q"), $("#hero-suggest"));
    $("#hero-go").onclick = () => { const a = App.resolve($("#hero-q").value) ?? (App.search($("#hero-q").value)[0] != null ? App.P.acc[App.search($("#hero-q").value)[0]] : null); if (a) location.hash = `#/protein/${a}`; };
    App.bindTips(el);
    if (exAcc) {
      const det = await App.details(exAcc);
      const host = $("#hero-imap");
      if (host) viz.interfaceMap(host, exAcc, det, { len: App.prot(exAcc).len, max: 9, compact: true });
    }
  };

  /* ── interface-resolved proteins: list of every cross-linked protein ── */
  views.proteins = async (el) => {
    const P = App.P, N = App.NOV, c = App.meta.counts, rows = [];
    P.acc.forEach((a, i) => {
      if (!(P.dH[i] + P.dJ[i])) return;
      rows.push({ acc: a, gene: P.gene[i], name: P.name[i], hek: P.dH[i], jur: P.dJ[i], nxl: P.nXL[i],
        loc: P.loc[i], newLoc: P.newLoc[i], upLoc: P.upLoc[i], nov: P.nov[i] });
    });
    const NEW_LABELS = [[N.loc, "localization"], [N.topo, "topology"], [N.correction, "topology correction"], [N.slim, "SLiM"], [N.contact, "contact site"]];
    const newText = (r) => NEW_LABELS.filter(([b]) => r.nov & b).map(([, l]) => l).join(", ");
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Binding interfaces</div><h1>Proteins with direct PPIs and binding interfaces</h1>
        <p>${fmt(rows.length)} proteins with at least one cross-link-resolved partner (${fmt(c.interPPIs.HEK293)} PPIs in HEK293). Click a protein to open its interface map: every partner with the cross-linked residue on both proteins.</p></div>
      <section class="card"><div id="prot-tbl"></div></section>${footer()}`;
    App.table($("#prot-tbl"), rows, [
      { key: "gene", label: "Gene", render: (r) => App.protLink(r.acc, r.gene) },
      { key: "acc", label: "UniProt", render: (r) => `<span class="mono">${esc(r.acc)}</span>` },
      { key: "hek", label: "Partners HEK293", num: true },
      { key: "jur", label: "Partners Jurkat", num: true },
      { key: "nxl", label: "Cross-links", num: true },
      { key: "loc", label: "Localization", value: (r) => App.locList(r.loc || r.upLoc).map(App.orgLabel).join("; "), render: (r) => App.locChips(r) },
      { key: "nov", label: "New in this study", value: newText, render: (r) => newText(r) ? App.newBadge("NEW") + " " + esc(newText(r)) : "" },
      { key: "name", label: "Protein name", wrap: true },
    ], { sort: 2, limit: rows.length, name: "interface_resolved_proteins", placeholder: "Filter by gene, UniProt ID or name…" });
  };

  /* ── protein ──────────────────────────────────────────────────────────── */
  // UniProt / OpenCell / HPA localization side by side, each linking to its own page
  const OC_NAMES = { er: "ER", nucleolus_gc: "nucleolus (granular component)", nucleolus_fc_dfc: "nucleolus (fibrillar centre / DFC)", big_aggregates: "big aggregates", cell_contact: "cell contact", focal_adhesions: "focal adhesions", nuclear_membrane: "nuclear membrane", nuclear_punctae: "nuclear punctae" };
  const extLoc = (acc, gene, det) => {
    const link = (href, txt) => `<a href="${href}" target="_blank" rel="noopener">${txt} ↗</a>`;
    const none = (txt) => `<span class="muted">${txt}</span>`;
    const cc = det?.cc ? esc(String(det.cc).replace(/SUBCELLULAR LOCATION:\s*/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+([;.,])/g, "$1")) : none("no subcellular location annotated");
    const oc = det?.opencell;
    const ocTxt = oc ? [[3, "prominent"], [2, "clear"], [1, "weak"]].filter(([g]) => oc[`g${g}`].length)
      .map(([g, w]) => `<span class="muted">${w}:</span> ${oc[`g${g}`].map((x) => esc(OC_NAMES[x] || x)).join(", ")}`).join("<br>") || none("tagged, no graded annotation")
      : none("not among the OpenCell tagged targets");
    const hpa = det?.hpa;
    const hpaTxt = hpa ? [hpa.main.length && `<span class="muted">main:</span> ${esc(hpa.main.join(", "))}`, hpa.add.length && `<span class="muted">additional:</span> ${esc(hpa.add.join(", "))}`]
      .filter(Boolean).join("<br>") + (hpa.rel ? `<br><span class="muted">reliability: ${esc(hpa.rel)}</span>` : "")
      : none("no HPA subcellular data");
    return `<div class="ext-loc">
      <div class="ext-src">${link(`https://www.uniprot.org/uniprotkb/${esc(acc)}/entry#subcellular_location`, "UniProt")}</div><div class="ext-val">${cc}</div>
      <div class="ext-src">${oc ? link(`https://opencell.czbiohub.org/target/${esc(oc.id)}`, "OpenCell") : "OpenCell"}</div><div class="ext-val">${ocTxt}</div>
      <div class="ext-src">${hpa ? link(`https://www.proteinatlas.org/${esc(hpa.ensg)}-${esc(hpa.name)}/subcellular`, "HPA") : "HPA"}</div><div class="ext-val">${hpaTxt}</div>
    </div>`;
  };

  // "New in this protein": everything this study adds beyond UniProt and the reference databases
  const newStrip = (p, det) => {
    const N = App.NOV, it = [];
    if (p.newLoc) it.push(`<a href="#" data-tab="loc">localization: ${App.locList(p.newLoc).map(App.orgLabel).map(esc).join(", ")}</a> (not in UniProt)`);
    const nl = (det?.loops || []).filter((l) => l.Agreement === "novel").length;
    if (p.nov & N.topo) it.push(`<a href="#" data-tab="topo">membrane topology: ${nl} loop side${nl > 1 ? "s" : ""}</a> not in UniProt`);
    if (p.nov & N.correction) it.push(`<a href="#" data-tab="topo">topology correction</a> of UniProt`);
    if (p.nov & N.slim) it.push(`<a href="#" data-tab="struct">${det.slims.length} candidate SLiM${det.slims.length > 1 ? "s" : ""}</a> (AF3 prediction)`);
    if (p.nov & N.contact) it.push(`contact-site candidate (${esc(det?.contact?.["Candidate Pool"] || "")}) not in CORUM / MCS databases`);
    return it.length ? `<div class="new-strip"><span class="lead-in">★ New in ${esc(p.gene)}</span>${it.map((x) => `<span class="item">${x}</span>`).join("")}</div>` : "";
  };

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

    const N = App.NOV, nDirect = rows.filter((r) => App.isOriginal(r.mask)).length;
    const tabs = [
      ["int", "Interactions", false],
      ["loc", "Localization", !!(p.newLoc || p.nov & N.contact)],
      ...(det?.loops?.length ? [["topo", "Topology", !!(p.nov & (N.topo | N.correction))]] : []),
      ["struct", "Structure", !!(p.nov & N.slim)],
    ];
    el.innerHTML = `
      <div class="prot-head">
        <div><div class="eyebrow">Protein</div><h1>${esc(p.gene)}</h1></div>
        <div><div class="pname">${esc(p.name || "")}</div>
          <div class="small muted"><span class="mono">${esc(acc)}</span> · <a href="https://www.uniprot.org/uniprotkb/${esc(acc)}" target="_blank" rel="noopener">UniProt ↗</a> · <a href="#/network/${esc(acc)}">Show in network</a>${p.len ? ` · ${fmt(p.len)} aa` : ""}${cxHits.map((c) => ` · <a href="#/complex/${c.name}">${c.name} model</a>`).join("")}</div>
          <div class="prot-sum"><span><b>${fmt(nDirect)}</b> direct partners</span><span><b>${fmt(p.nXL)}</b> residue pairs</span>${nAug ? `<span><b>${fmt(nAug)}</b> augmented partners</span>` : ""}${det?.slims?.length ? `<span><b>${fmt(det.slims.length)}</b> candidate SLiMs</span>` : ""}${p.tm ? `<span><b>${p.tm}</b> TM helices</span>` : ""}</div></div>
        <div class="chips" style="margin-left:auto">${App.locChips(p)}</div>
      </div>
      ${newStrip(p, det)}
      <nav class="tabs" role="tablist">${tabs.map(([id, label, isNew]) => `<button role="tab" data-tab="${id}">${label}${isNew ? ` <span class="nb">NEW</span>` : ""}</button>`).join("")}</nav>

      <div class="tab-pane" data-pane="int" hidden>
        <section class="card imap-card" style="margin-bottom:16px" id="sec-imap">
          <h2><span>Interface map of ${esc(p.gene)} ${App.info(`Each row is a directly cross-linked partner, with the cross-linked lysine on both proteins. Unlike AP-MS co-purification or STRING association scores, every interaction here is a direct contact with a known site on both proteins. ${fmt(nInterH)} HEK293 inter-protein residue pairs.`)}</span>
            <span class="toggles" id="imap-cell"><label><input type="checkbox" value="1" checked> HEK293</label><label><input type="checkbox" value="2" checked> Jurkat</label></span></h2>
          <div class="imap-tools"><span>Order partners by</span><span class="seg" id="imap-sort"><button data-s="links" class="on">number of links</button><button data-s="pos">position on ${esc(p.gene)}</button></span>
            <span class="legend" style="margin:0">${[1, 2, 3].map((k) => `<span><span class="dot" style="background:${viz.CELL_COLORS[k]};margin-right:5px"></span>${viz.CELL_LABELS[k]}</span>`).join("")}</span></div>
          ${App.howto([
            `Each row is one partner; the partner name is on the far right.`,
            `Left bar: the sequence of ${esc(p.gene)} from residue 1 to ${p.len ? fmt(p.len) : "its end"}. Right bar: the partner sequence, scaled to its own length.`,
            `Dots are cross-linked lysines; their colour gives the cell line (blue HEK293, green Jurkat, purple both).`,
            `The histogram on top is the interface footprint: how many partners bind each region of ${esc(p.gene)}. TM helices and candidate SLiMs are marked there.`,
            `Hover a row to draw a line for each residue pair.`])}
          <div id="imap"></div>
          <div class="imap-more" id="imap-more"></div>
          ${nAug ? `<p class="small muted" style="margin:8px 0 0">${fmt(nAug)} further partner(s) come from database augmentation and have no residue-level evidence; they are listed under Interactors below.</p>` : ""}
        </section>
        <section class="card" style="margin-bottom:16px">
          <h2>Interactors ${App.info(`HEK293 / Jurkat: directly cross-linked in DUC-XL-MS. "… augmented": not a cited interaction. It is reported by that database and added by our triadic-closure rule because both proteins share at least one DUC-XL-MS neighbour (listed in the last column).`)}</h2>
          <div id="int-tbl"></div>
        </section>
        <section class="card" style="margin-bottom:16px">
          <h2>Interaction neighbourhood <span class="small muted">${rows.length > 70 ? "top 70 by residue pairs" : ""}</span></h2>
          ${App.howto([
            `${esc(p.gene)} is in the centre; each surrounding node is a partner.`,
            `Node colour: the partner's compartment; a ring marks a second compartment.`,
            `Solid edges are cross-linked, with width proportional to residue pairs; dashed edges are augmented from other resources.`])}
          <div id="ego" style="max-width:560px;margin:0 auto"></div>
          <div class="legend">${App.meta.compartments.map((c) => `<span><span class="dot" style="background:${App.orgColor(c)};margin-right:5px"></span>${esc(App.orgLabel(c))}</span>`).join("")}<span><span class="dot" style="background:var(--aug);margin-right:5px"></span>Unassigned</span></div>
        </section>
      </div>

      <div class="tab-pane" data-pane="loc" hidden>
        <section class="card${p.newLoc ? " has-new" : ""}" style="margin-bottom:16px" id="sec-loc">
          <h2>Localization ${p.newLoc ? App.newBadge() : ""} ${App.info(loc.length ? "DUC-XL-MS: graph-based propagation from curated organelle markers along cross-link edges, compared with UniProt, OpenCell and HPA." : "No DUC-XL-MS assignment. The UniProt annotation is shown, with OpenCell and HPA for comparison.")}</h2>
          <div class="grid g2">
            <dl class="kv">
              ${loc.length ? `<dt>DUC-XL-MS</dt><dd><div class="chips">${App.locChips(p)}</div>${p.newLoc ? `<div class="small" style="margin-top:4px;color:var(--new-ink)">${App.locList(p.newLoc).map(App.orgLabel).map(esc).join(", ")}: not annotated in UniProt</div>` : ""}</dd>` : ""}
              <dt>UniProt</dt><dd>${det?.upTerms?.length ? esc(det.upTerms.join("; ")) : `<span class="muted">no subcellular location</span>`}</dd>
              <dt>Evidence</dt><dd>${pr["Annotation Source"] === "marker_seed" ? "Organelle marker (seed)" : pr["Annotation Source"] === "propagation" ? "Propagated from cross-linked markers" : "—"}</dd>
              ${pr["Confidence Tier"] ? `<dt>Tier</dt><dd>${esc(pr["Confidence Tier"])} ${pr["Localization Class"] && pr["Localization Class"] !== "seed" ? `· ${esc(pr["Localization Class"])}` : ""}</dd>` : ""}
              ${pr["Vote Fraction"] != null ? `<dt>Vote fraction</dt><dd class="num">${perComp(pr["Vote Fraction"], (v) => (+v).toFixed(2))}</dd>` : ""}
              ${pr["Seeds per Compartment"] ? `<dt>Seed neighbours</dt><dd class="num">${perComp(pr["Seeds per Compartment"], (v) => v)}</dd>` : ""}
              ${mo?.Correction ? `<dt>Curation</dt><dd>${esc(mo.Correction)}${mo.Evidence ? ` — ${esc(mo.Evidence)}` : ""}</dd>` : ""}
              ${mt ? `<dt>Topology marker</dt><dd>${esc(mt["Topology Pole"])}${mt.Correction ? ` · ${esc(mt.Correction)}` : ""}</dd>` : ""}
              ${det?.contact ? `<dt>Contact site</dt><dd>candidate (${esc(det.contact["Candidate Pool"] || "")})${p.nov & N.contact ? ` ${App.newBadge("NEW", "Not in CORUM or membrane-contact-site databases")}` : ""}</dd>` : ""}
            </dl>
            <div><h3 class="ext-head" style="margin-top:0">Other resources</h3>${extLoc(acc, p.gene, det)}</div>
          </div>
        </section>
      </div>

      ${det?.loops?.length ? `<div class="tab-pane" data-pane="topo" hidden>
        <section class="card${p.nov & (N.topo | N.correction) ? " has-new" : ""}" style="margin-bottom:16px" id="sec-topo">
          <h2>Membrane topology ${p.nov & N.topo ? App.newBadge("NEW", "Loop side(s) not annotated in UniProt") : ""} ${p.nov & N.correction ? App.newBadge("CORRECTS UNIPROT", "Credible correction of the UniProt topology") : ""} ${App.info(`${p.tm ? `${p.tm} UniProt-annotated TM helices (TRANSMEM). ` : ""}Domains between helices are named as in the UniProt topology; their membrane side is assigned from cross-links to topology markers. Numbers are residue ranges.`)}</h2>
          ${App.howto([
            `The horizontal band is the membrane: the upper side is the cytoplasm, the lower side the lumen or extracellular space.`,
            `Dark blocks are the UniProt TM helices; the segments between them are loops, drawn on the side assigned by DUC-XL-MS.`,
            `Loop colour compares the DUC-XL-MS side with UniProt (key below); N and C mark the protein termini.`,
            `The track under the diagram shows the UniProt annotation; the table lists the evidence per domain.`])}
          <div id="topo"></div>
          <div class="legend">
            <span><span class="sw" style="background:var(--ok);height:5px"></span>DUC-XL-MS side, agrees with UniProt</span>
            <span><span class="sw" style="background:var(--accent);height:5px"></span>DUC-XL-MS side, not annotated in UniProt <span class="nb">NEW</span></span>
            <span><span class="sw" style="background:var(--bad);height:5px"></span>DUC-XL-MS side, conflicts with UniProt</span>
            <span><span class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 6px,transparent 6px 10px)"></span>UniProt side only (no cross-link evidence)</span>
            <span><span class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 2px,transparent 2px 6px)"></span>side inferred by alternation</span>
            <span><span class="dot" style="background:var(--ink-2);border-radius:2px;width:8px;height:14px"></span> TM helix (UniProt)</span>
            <span><b>N</b> / <b>C</b>: protein termini</span>
          </div>
          <div id="topo-track" class="topo-track"></div>
          ${det.tm?.["Inconsistent Flag"] ? `<p class="small tag-conflict" style="margin:8px 0 0">⚠ The assigned domain sides are not mutually consistent with the UniProt TM helices (dashed red helix: both flanking domains on the same side).</p>` : ""}
          <div id="topo-tbl" style="margin-top:20px"></div>
        </section>
      </div>` : ""}

      <div class="tab-pane" data-pane="struct" hidden>
        ${det?.slims?.length ? `<section class="card has-new" style="margin-bottom:16px" id="sec-slim"><h2>Candidate short linear motifs ${App.newBadge("NEW", "Predicted by the cross-link-guided AF3 screen of this study")} ${App.info("AlphaFold3 SLiM screen of cross-link-supported PPIs. ΔpLDDT: gain in confidence on binding; ipSAE: interface confidence.")}</h2><div id="slim-tbl"></div></section>` : ""}
        <section class="card" style="margin-bottom:16px">
          <h2>Sequence view of all cross-links
            <span class="toggles" id="cell-tg"><label><input type="checkbox" value="1" checked> HEK293</label><label><input type="checkbox" value="2" checked> Jurkat</label></span></h2>
          ${App.howto([
            `The bar is the sequence of ${esc(p.gene)}.`,
            `Arcs above it are intra-protein cross-links; ticks below are inter-protein cross-links per lysine, taller for more links.`,
            `Coloured bands mark membrane loops (cyan = cytosolic, gold = other side) and candidate SLiMs (orange).`,
            `Scroll to zoom, drag to pan, double-click to reset; at maximum zoom the amino-acid sequence appears.`])}
          <div id="track" class="track-wrap"></div>
          <div class="legend">${[1, 2, 3].map((k) => `<span><span class="sw" style="background:${viz.CELL_COLORS[k]}"></span>${viz.CELL_LABELS[k]}</span>`).join("")}</div>
        </section>
        ${cxHits.length ? `<section class="card" style="margin-bottom:16px"><h2>Complex models</h2><p style="margin:0">${cxHits.map((c) => `<a class="btn small" href="#/complex/${c.name}">${c.name} assembly model →</a>`).join(" ")}</p></section>` : ""}
      </div>
      ${footer()}`;

    App.bindTips(el);
    // each tab is drawn the first time it is shown, so its plots get the right width
    const drawn = new Set();
    const draw = {
      int: () => {
        const im = { sort: "links", all: false };
        const drawImap = () => {
          const cells = $$("#imap-cell input").reduce((s, i) => s | (i.checked ? +i.value : 0), 0) || 3;
          const r = viz.interfaceMap($("#imap"), acc, det, { len: p.len, sort: im.sort, max: im.all ? 0 : 25, cells });
          $("#imap-more").innerHTML = r.total > 25 ? `<button class="btn small" id="imap-all">${im.all ? "Show top 25 partners" : `Show all ${fmt(r.total)} partners`}</button>` : "";
          const b = $("#imap-all"); if (b) b.onclick = () => { im.all = !im.all; drawImap(); };
        };
        $$("#imap-sort button").forEach((b) => (b.onclick = () => { im.sort = b.dataset.s; $$("#imap-sort button").forEach((x) => x.classList.toggle("on", x === b)); drawImap(); }));
        $$("#imap-cell input").forEach((i) => (i.onchange = drawImap));
        drawImap();
        App.table($("#int-tbl"), rows, [
          { key: "gene", label: "Partner", render: (r) => App.protLink(r.acc, r.gene) },
          { key: "loc", label: "Compartment", value: (r) => r.loc.map(App.orgLabel).join("; "), render: (r) => r.loc.map((c) => `<span class="dot" style="background:${App.orgColor(c)}"></span> ${esc(App.orgLabel(c))}`).join(" ") || `<span class="muted">–</span>` },
          { key: "mask", label: "Sources", value: (r) => App.srcText(r.mask), render: (r) => App.srcBadges(r.mask) },
          { key: "rpH", label: "Residue pairs HEK293", num: true },
          { key: "rpJ", label: "Residue pairs Jurkat", num: true },
          { key: "common", label: "Shared neighbours (augmented)", render: (r) => esc(r.common || "") },
        ], { sort: 3, name: `${p.gene}_interactors`, placeholder: "Filter partners…" });
        viz.ego($("#ego"), { gene: p.gene, loc }, rows, 70);
      },
      loc: () => {},
      topo: () => {
        const topo = viz.topology($("#topo"), det, p.len, $("#topo-track"));
        const L = det.uniprot?.len || p.len;
        $("#topo-tbl").innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Domain</th><th class="num">Residues</th><th>DUC-XL-MS side</th><th>UniProt (TOPO_DOM)</th><th>Comparison</th><th class="num">Residue pairs</th><th class="num">Purity</th><th>Confidence</th></tr></thead><tbody>${
          det.loops.slice().sort((a, b) => viz.loopRange(a, L)[0] - viz.loopRange(b, L)[0]).map((l) => {
            const [a, b] = viz.loopRange(l, L);
            const reg = topo && topo.regs.find((r) => r.id === l["Loop ID"]);
            const isNew = l.Agreement === "novel" || (l.Agreement === "conflict" && l["Credible Correction"] === "Yes");
            return `<tr class="${isNew ? "row-new" : ""}"><td>${esc(viz.regionName(l["Loop ID"]))}</td><td class="num">${a}–${b}</td><td>${esc(viz.SIDE_NAMES[l["Assigned Side"]] || l["Assigned Side"])}</td><td>${esc(reg?.upNote || "not annotated")}</td><td class="tag-${esc(l.Agreement)}">${l.Agreement === "novel" ? `${App.newBadge()} not in UniProt` : l.Agreement === "conflict" && l["Credible Correction"] === "Yes" ? `${App.newBadge("CORRECTS UNIPROT")}` : l.Agreement === "conflict" ? "conflict (low confidence)" : esc(l.Agreement)}</td><td class="num">${fmt(l["Residue Pair Count"])}</td><td class="num">${l.Purity}</td><td>${esc(l.Confidence)}</td></tr>`;
          }).join("")}</tbody></table></div>`;
      },
      struct: () => {
        const drawTrack = () => {
          const m = $$("#cell-tg input").reduce((s, i) => s | (i.checked ? +i.value : 0), 0);
          viz.seqTrack($("#track"), acc, det, p.len, m || 3);
        };
        $$("#cell-tg input").forEach((i) => (i.onchange = drawTrack)); drawTrack();
        if (det?.slims?.length) App.table($("#slim-tbl"), det.slims, [
          { key: "Partner Gene Symbol", label: "Partner", render: (r) => App.protLink(String(r["Partner Protein ID"]).toUpperCase(), r["Partner Gene Symbol"]) },
          { key: "Start Residue", label: "Start", num: true }, { key: "End Residue", label: "End", num: true },
          { key: "Motif Sequence", label: "Sequence", render: (r) => `<span class="mono">${esc(r["Motif Sequence"])}</span>` },
          { key: "dpLDDT", label: "ΔpLDDT", num: true }, { key: "Max ipSAE", label: "max ipSAE", num: true },
          { key: "Cross-Link Count", label: "Cross-links", num: true },
        ], { sort: 4, name: `${p.gene}_slims` });
      },
    };
    const show = (id) => {
      $$(".tabs [data-tab]", el).forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      $$(".tab-pane", el).forEach((pn) => (pn.hidden = pn.dataset.pane !== id));
      if (!drawn.has(id)) { drawn.add(id); draw[id](); }
    };
    $$(".tabs [data-tab]", el).forEach((b) => (b.onclick = () => show(b.dataset.tab)));
    $$(".new-strip [data-tab]", el).forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.tab); $(".tabs", el).scrollIntoView({ behavior: "smooth", block: "start" }); }));
    show("int");
  };

  /* ── new findings ─────────────────────────────────────────────────────── */
  views.newFindings = async (el, sec) => {
    const c = App.meta.counts;
    const [nw, slims] = await Promise.all([App.load("new"), App.load("slims")]);
    const prot = (acc) => App.prot(acc) || {};
    const secs = [
      ["loc", "Localization", c.newLoc, "proteins"], ["topo", "Membrane topology", c.novelLoops + c.corrections, "loop sides"],
      ["slim", "Short linear motifs", c.slimCandidates, "candidates"], ["contact", "Contact sites", c.newContacts, "candidates"],
    ];
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow" style="color:var(--new-ink)">★ New findings</div><h1>What DUC-XL-MS adds</h1>
        <p>Findings of this study beyond UniProt and the reference databases, in one place: new membrane-loop sides and credible topology corrections, contact-site candidates not in CORUM or MCS databases, candidate SLiMs, and localizations that UniProt does not list (propagated labels compared with the UniProt annotation). Each entry links to the protein page, where the new finding is highlighted next to the residue-level evidence behind it.</p></div>
      <section class="grid g4 new-tiles" style="margin-bottom:16px">${secs.map(([k, l, n, u]) =>
        `<a class="card stat" href="#/new?s=${k}" data-sec="${k}"><div class="v num">${fmt(n)}</div><div class="l">${l} <span class="nb">NEW</span></div><div class="s">${u}</div></a>`).join("")}</section>
      <section class="card has-new" id="new-loc" style="margin-bottom:16px">
        <h2>New organelle localizations</h2>
        <div class="card-sub">Proteins confidently placed by DUC-XL-MS label propagation in a compartment that their UniProt subcellular location does not list (UniProt terms mapped to compartments with the curated term table). ${fmt(c.newLocNoUniProt)} of them had no UniProt organelle annotation at all.</div>
        <div id="t-loc"></div></section>
      <section class="card has-new" id="new-topo" style="margin-bottom:16px">
        <h2>New membrane topology</h2>
        <div class="card-sub">${fmt(c.novelLoops)} loop sides in ${fmt(c.novelLoopProteins)} transmembrane proteins that UniProt does not annotate, and ${fmt(c.corrections)} high-confidence conflicts that credibly correct UniProt.</div>
        <div id="t-topo"></div></section>
      <section class="card has-new" id="new-slim" style="margin-bottom:16px">
        <h2>Candidate short linear motifs</h2>
        <div class="card-sub">${fmt(c.slimCandidates)} candidate motifs in ${fmt(c.slimProteins)} proteins from the cross-link-guided AlphaFold3 screen (43.7% sensitivity at 4.4% FDR against ELM-derived controls). These are predictions: several match known ELM motif classes (e.g. PAM2, NLS, 14-3-3 sites), while hubs such as ERH and RACK1 bind motifs absent from ELM.</div>
        <div id="t-slim"></div></section>
      <section class="card has-new" id="new-contact" style="margin-bottom:16px">
        <h2>New contact-site candidates</h2>
        <div class="card-sub">Dual-localized or topology-resolved transmembrane proteins that are not trafficking (CORUM) or membrane-contact-site machinery in existing databases.</div>
        <div id="t-contact"></div></section>
      ${footer()}`;
    const g = (acc, gene) => App.protLink(acc, gene || App.geneOf(acc));
    const comps = (s, nw_ = "") => { const n = new Set(App.locList(nw_)); return App.locList(s).map((x) => `<span class="dot" style="background:${App.orgColor(x)}"></span> ${n.has(x) ? `<b>${esc(App.orgLabel(x))}</b> ${App.newBadge()}` : esc(App.orgLabel(x))}`).join("<br>"); };
    App.table($("#t-loc"), nw.loc, [
      { key: "gene", label: "Protein", render: (r) => g(r.acc, r.gene) },
      { key: "loc", label: "DUC-XL-MS localization", value: (r) => App.locList(r.loc).map(App.orgLabel).join("; "), render: (r) => comps(r.loc, r.new) },
      { key: "uniprot", label: "UniProt subcellular location", wrap: true, render: (r) => r.uniprot ? esc(r.uniprot) : `<span class="muted">none</span>` },
      { key: "cls", label: "Class" },
      { key: "vote", label: "Vote fraction", render: (r) => esc(String(r.vote)) },
      { key: "nXL", label: "Residue pairs", num: true, value: (r) => prot(r.acc).nXL },
    ], { sort: 0, dir: 1, name: "new_localizations", placeholder: "Filter by protein or compartment…" });
    App.table($("#t-topo"), nw.topo, [
      { key: "Gene Symbol", label: "Protein", render: (r) => g(r["Protein ID"], r["Gene Symbol"]) },
      { key: "Loop ID", label: "Domain", text: (r) => viz.regionName(r["Loop ID"]), render: (r) => esc(viz.regionName(r["Loop ID"])) },
      { key: "Loop Range", label: "Residues" },
      { key: "Assigned Side", label: "DUC-XL-MS side", text: (r) => viz.SIDE_NAMES[r["Assigned Side"]] || r["Assigned Side"], render: (r) => `<b>${esc(viz.SIDE_NAMES[r["Assigned Side"]] || r["Assigned Side"])}</b>` },
      { key: "UniProt Side", label: "UniProt", text: (r) => viz.SIDE_NAMES[r["UniProt Side"]] || "not annotated", render: (r) => r["UniProt Side"] ? esc(viz.SIDE_NAMES[r["UniProt Side"]] || r["UniProt Side"]) : `<span class="muted">not annotated</span>` },
      { key: "Agreement", label: "Finding", text: (r) => r.Agreement === "novel" ? "new" : "corrects UniProt", render: (r) => r.Agreement === "novel" ? `${App.newBadge()} not in UniProt` : App.newBadge("CORRECTS UNIPROT") },
      { key: "Residue Pair Count", label: "Residue pairs", num: true },
      { key: "Confidence", label: "Confidence" },
    ], { sort: 0, dir: 1, name: "new_topology", placeholder: "Filter by protein or side…" });
    App.table($("#t-slim"), slims, [
      { key: "Motif Gene Symbol", label: "Motif protein", render: (r) => g(String(r["Motif Protein ID"]).toUpperCase(), r["Motif Gene Symbol"]) },
      { key: "Partner Gene Symbol", label: "Binds", render: (r) => g(String(r["Partner Protein ID"]).toUpperCase(), r["Partner Gene Symbol"]) },
      { key: "Start Residue", label: "Start", num: true }, { key: "End Residue", label: "End", num: true },
      { key: "Motif Sequence", label: "Sequence", render: (r) => `<span class="mono">${esc(r["Motif Sequence"])}</span>` },
      { key: "dpLDDT", label: "ΔpLDDT", num: true }, { key: "Max ipSAE", label: "max ipSAE", num: true },
    ], { sort: 6, name: "new_slims", placeholder: "Filter by protein or sequence…" });
    App.table($("#t-contact"), nw.contacts, [
      { key: "Gene Symbol", label: "Protein", render: (r) => g(r["Protein ID"], r["Gene Symbol"]) },
      { key: "Candidate Pool", label: "Evidence", text: (r) => ({ TM: "resolved TM topology", dual: "dual localization", "dual+TM": "dual localization + TM topology" })[r["Candidate Pool"]] || r["Candidate Pool"] },
      { key: "Localization/Topology", label: "Localization / topology", wrap: true, text: (r) => locTopo(r["Localization/Topology"]).join("; "), render: (r) => locTopo(r["Localization/Topology"]).map(esc).join("<br>") },
      { key: "Protein Names", label: "Name", wrap: true },
    ], { sort: 0, dir: 1, name: "new_contact_sites", placeholder: "Filter…" });
    App.bindTips(el);
    if (sec) setTimeout(() => document.getElementById(`new-${sec}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /* ── network ──────────────────────────────────────────────────────────── */
  // Levels: the whole map (Louvain groups, links between groups hidden by default); a group;
  // the subnetwork of a clicked protein (it, its partners and the links among them); the residue
  // view (d3), where proteins can be drawn as sequence bars and cross-links run residue to residue.
  // "← back", Esc or a click on the background goes up one level.
  views.network = async (el, focusAcc) => {
    const [net, grp] = await Promise.all([App.network(), App.load("network_groups")]);
    const groups = grp.groups, bigGroups = groups.filter((g) => g.kind === "c").sort((a, b) => b.count - a.count);
    el.innerHTML = `
      <div class="page-head"><div class="eyebrow">Systems</div><h1>Interactome network</h1>
        <p>${fmt(net.edges.length)} PPIs among ${fmt(net.nodes.length)} proteins in the HEK293 + Jurkat core interactome, in one ForceAtlas2 (LinLog) layout where tightly cross-linked assemblies form clusters; colour marks the compartment. The map opens on ${fmt(bigGroups.length)} groups of densely connected proteins: click a group to zoom in, a protein for its subnetwork, and double-click a protein for the residue view.</p></div>
      <div class="net-layout" id="net-layout">
        <div class="card net-panel">
          <h3>Find protein</h3>
          <input type="search" id="net-q" placeholder="Gene symbol" style="width:100%">
          <h3>Edge evidence</h3>
          <div class="check-list" id="net-src">
            ${[[1, "DUC-XL-MS · HEK293"], [2, "DUC-XL-MS · Jurkat"], [4, "Augmented · BioPlex 3.0"], [8, "Augmented · OpenCell"], [16, "Augmented · EndoMAP"]]
              .map(([b, l]) => `<label><input type="checkbox" value="${b}"${b < 4 ? " checked" : ""}> ${l}</label>`).join("")}
          </div>
          <div class="small muted">Augmented edges (no residue-level evidence) are off by default.</div>
          <h3>Minimum residue pairs</h3>
          <div class="range-row"><input type="range" id="net-rp" min="0" max="10" value="0"><span id="net-rp-v" class="num">0</span></div>
          <div class="small muted">Applies to cross-linked edges.</div>
          <h3>Display</h3>
          <div class="check-list">
            <label><input type="checkbox" id="net-glab" checked> group names</label>
            <label><input type="checkbox" id="net-cross"> links between groups</label>
          </div>
          <h3>Compartment</h3>
          <select id="net-org" style="width:100%"><option value="">All compartments</option>${App.meta.compartments.map((c) => `<option value="${c}">${esc(App.orgLabel(c))}</option>`).join("")}<option value="__none">Unassigned only</option></select>
          <div class="legend" style="flex-direction:column;gap:4px;margin-top:12px">${App.meta.compartments.map((c) => `<span><span class="dot" style="background:${App.orgColor(c)};margin-right:6px"></span>${esc(App.orgLabel(c))}</span>`).join("")}<span><span class="dot" style="background:var(--aug);margin-right:6px"></span>Unassigned</span></div>
        </div>
        <div class="card net-canvas">
          <div id="sigma"></div>
          <svg id="net-sub" hidden aria-label="Residue view of the selected subnetwork"></svg>
          <div class="net-subbar" id="net-subbar" hidden>
            <button class="btn small" id="sub-back">← Subnetwork</button><span class="muted" id="sub-info"></span>
            <label><input type="checkbox" id="sub-pp" checked> links among partners</label>
            <button class="btn small" id="sub-bars">All as bars</button><button class="btn small" id="sub-nodes">All as nodes</button>
            <span class="muted">double-click a protein to toggle its sequence bar · click a link for its residue pairs</span>
          </div>
          <button class="btn small primary net-back" id="net-back" hidden></button>
          <div class="net-count" id="net-count"></div>
          <div class="net-hint" id="net-hint"></div>
          <button class="btn small net-fs" id="net-fs" title="Full screen (Esc to leave)">⛶ Full screen</button>
        </div>
        <div class="card net-panel" id="net-side"></div>
      </div>`;

    const HINT = "Scroll to zoom · click a group or protein to zoom in · double-click a protein for the residue view · Esc or the background goes back";
    $("#net-hint").textContent = HINT;
    const G = new graphology.Graph({ multi: false, type: "undirected" });
    const aug = App.cssVar("--aug") || "#a0a3aa";
    net.nodes.forEach((g, i) => {
      const loc = App.locList(App.nodeLoc(net, i));
      G.addNode(i, { kind: "p", x: net.xy[i][0], y: net.xy[i][1], label: g, grp: grp.of[i], size: 0.8 + Math.min(4.5, Math.log2(net.adj[i].length + 1) * 0.5), color: loc[0] ? App.meta.organelleColors[loc[0]] : aug, loc });
    });
    net.edges.forEach((e, k) => {
      if (G.hasEdge(e[0], e[1])) return;
      const rp = Math.max(e[3], e[4]);
      G.addEdgeWithKey(k, e[0], e[1], { mask: e[2], rp, h: e[3], j: e[4], cross: grp.of[e[0]] !== grp.of[e[1]], size: 0.25 + Math.min(1.2, Math.log2(rp + 1) * 0.18) });
    });
    // proteins that only have augmented edges are hidden while augmented edges are off
    G.forEachEdge((k, a, s, t) => { if (App.isOriginal(a.mask)) { G.setNodeAttribute(s, "orig", true); G.setNodeAttribute(t, "orig", true); } });
    // group names: one tiny label node per group of at least 15 proteins
    bigGroups.filter((g) => g.count >= 15).forEach((g) => G.addNode("m:" + g.id, { kind: "m", gid: g.id, x: g.x, y: g.y, label: g.label, size: 0.1 }));

    const st = { src: 3, rp: 0, org: "", sel: null, neigh: new Set(), edge: null, grp: null, cross: false, glab: true };
    const edgeOk = (a) => (a.mask & st.src) && (!App.isOriginal(a.mask) || a.rp >= st.rp || !(a.mask & 3));
    const nodeOk = (n, a) => !st.org || (st.org === "__none" ? !a.loc.length : a.loc.includes(st.org));
    const baseOk = (k, a) => { const [s, t] = G.extremities(k); return edgeOk(a) && nodeOk(s, G.getNodeAttributes(s)) && nodeOk(t, G.getNodeAttributes(t)); };
    const rgba = (hex, al) => { const h = String(hex).trim().replace("#", ""); if (h.length < 6) return hex; const v = parseInt(h.slice(0, 6), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${al})`; };
    let C = {};
    const palette = () => { C = { edge: rgba(App.cssVar("--net-edge"), 0.55), aug: rgba(aug, 0.35), ink2: App.cssVar("--ink-2"), dim: App.cssVar("--grid"), bg: App.cssVar("--surface"), accent: App.cssVar("--accent") }; };
    palette();
    const renderer = new Sigma(G, $("#sigma"), {
      labelRenderedSizeThreshold: 9, labelDensity: 0.08, labelColor: { color: App.cssVar("--ink") }, zIndex: true,
      enableEdgeEvents: true, enableEdgeClickEvents: true, enableEdgeHoverEvents: true,
      // label box of the selected protein in the theme's surface colour (sigma's default box is always white)
      hoverRenderer: (ctx, d, s) => {
        const size = s.labelSize, pad = 2;
        ctx.font = `${s.labelWeight} ${size}px ${s.labelFont}`;
        ctx.fillStyle = C.bg; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 8; ctx.shadowColor = "rgba(0,0,0,0.35)";
        const radius = Math.max(d.size, size / 2) + pad;
        ctx.beginPath();
        if (typeof d.label === "string" && d.label) {
          const w = Math.round(ctx.measureText(d.label).width + 5), h = Math.round(size + 2 * pad);
          const ang = Math.asin(h / 2 / radius), dx = Math.sqrt(Math.abs(radius ** 2 - (h / 2) ** 2));
          ctx.moveTo(d.x + dx, d.y + h / 2); ctx.lineTo(d.x + radius + w, d.y + h / 2);
          ctx.lineTo(d.x + radius + w, d.y - h / 2); ctx.lineTo(d.x + dx, d.y - h / 2);
          ctx.arc(d.x, d.y, radius, ang, -ang);
        } else ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
        if (d.label) { ctx.fillStyle = App.cssVar("--ink"); ctx.fillText(d.label, d.x + d.size + 3, d.y + size / 3); }
      },
      nodeReducer: (n, a) => {
        const r = { ...a };
        if (a.kind === "m") {
          r.hidden = !st.glab || st.sel != null || (st.grp != null && st.grp !== a.gid);
          r.forceLabel = true; r.color = C.bg; r.zIndex = 3;
          return r;
        }
        if (!nodeOk(n, a) || (!a.orig && !(st.src & 28))) { r.hidden = true; return r; }
        if (st.sel != null) {
          // subnetwork: only the selected protein and its partners stay on the map
          if (+n === st.sel) { r.highlighted = true; r.zIndex = 2; r.size = a.size + 3; }
          else if (st.neigh.has(+n)) { r.zIndex = 1; r.forceLabel = st.neigh.size < 60; }
          else r.hidden = true;
        } else if (st.grp != null && a.grp !== st.grp) { r.color = C.dim; r.label = ""; r.zIndex = 0; }
        return r;
      },
      edgeReducer: (k, a) => {
        const r = { ...a };
        if (!baseOk(k, a)) { r.hidden = true; return r; }
        const [s, t] = G.extremities(k), orig = App.isOriginal(a.mask);
        r.color = orig ? C.edge : C.aug;
        if (k === st.edge) { r.size = 3.5; r.color = C.accent; r.zIndex = 2; return r; }
        if (st.sel != null) {
          if (+s === st.sel || +t === st.sel) { r.size = Math.max(a.size, 1.2); r.color = orig ? C.ink2 : aug; r.zIndex = 1; }
          else if (st.neigh.has(+s) && st.neigh.has(+t)) { r.zIndex = 0; }   // links among partners
          else r.hidden = true;
          return r;
        }
        if (a.cross && !st.cross) { r.hidden = true; return r; }
        if (st.grp != null && G.getNodeAttribute(s, "grp") !== st.grp && G.getNodeAttribute(t, "grp") !== st.grp) r.hidden = true;
        return r;
      },
    });
    const count = () => {
      let ne = 0; G.forEachEdge((k, a) => { if (baseOk(k, a) && (st.cross || !a.cross)) ne++; });
      $("#net-count").textContent = `${fmt(ne)} edges shown${st.cross ? "" : " (links between groups hidden)"}`;
    };
    const refresh = () => { renderer.refresh(); count(); subHighlight(); updateBack(); };
    // fit the camera to a set of proteins
    function fitNodes(list) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      list.forEach((n) => { const d = renderer.getNodeDisplayData(n); if (!d) return; x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); });
      if (!isFinite(x0)) return;
      renderer.getCamera().animate({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ratio: Math.min(1, Math.max(0.03, Math.max(x1 - x0, y1 - y0) * 1.3)) }, { duration: 500 });
    }
    const groupMembers = (gid) => { const m = []; grp.of.forEach((g, i) => { if (g === gid) m.push(i); }); return m; };

    // "back" goes up one level: residue view → subnetwork → group → whole network
    function updateBack() {
      const b = $("#net-back");
      if (sub || (st.sel == null && st.grp == null)) { b.hidden = true; return; }
      b.hidden = false;
      b.textContent = st.sel != null && st.grp != null ? `← Group: ${groups[st.grp].label}` : "← Whole network";
    }
    function back() {
      if (sub) return closeSub();
      if (st.sel != null && st.grp != null) return selectGroup(st.grp);
      if (st.sel != null || st.grp != null) return home();
    }
    function home() {
      st.sel = null; st.neigh = new Set(); st.edge = null; st.grp = null;
      const max = bigGroups[0]?.count || 1, small = groups.find((g) => g.kind === "s");
      $("#net-side").innerHTML = `
        <div class="eyebrow">Whole network</div>
        <p class="small muted" style="margin:4px 0 10px">Groups of densely connected proteins (Louvain community detection), named after their three most connected proteins. Click a group to zoom to it; click a protein for its subnetwork.</p>
        <h3>Groups by size</h3>
        <div class="grp-list">${bigGroups.map((g) => `<a href="javascript:void 0" data-g="${g.id}"><span class="g">${esc(g.label)}</span><span class="bar"><i style="width:${Math.max(3, (100 * g.count) / max)}%"></i></span><span class="n num">${fmt(g.count)}</span></a>`).join("")}
        ${small ? `<a href="javascript:void 0" data-g="${small.id}"><span class="g muted">${esc(small.label)}</span><span class="bar"><i style="width:${Math.max(3, (100 * small.count) / max)}%"></i></span><span class="n num">${fmt(small.count)}</span></a>` : ""}</div>`;
      $$("#net-side [data-g]").forEach((l) => (l.onclick = () => selectGroup(+l.dataset.g)));
      refresh(); renderer.getCamera().animatedReset({ duration: 400 });
    }
    function selectGroup(gid) {
      st.sel = null; st.neigh = new Set(); st.edge = null; st.grp = gid;
      const g = groups[gid], members = groupMembers(gid), inside = new Map(members.map((i) => [i, 0])), linked = new Map();
      G.forEachEdge((k, a, s, t) => {
        if (!edgeOk(a)) return;
        const gs = grp.of[+s], gt = grp.of[+t];
        if (gs === gid && gt === gid) { inside.set(+s, inside.get(+s) + 1); inside.set(+t, inside.get(+t) + 1); }
        else if (gs === gid || gt === gid) { const o = gs === gid ? gt : gs; linked.set(o, (linked.get(o) || 0) + 1); }
      });
      const mem = [...inside.entries()].sort((x, y) => y[1] - x[1] || net.nodes[x[0]].localeCompare(net.nodes[y[0]]));
      const lk = [...linked.entries()].sort((x, y) => y[1] - x[1]).slice(0, 15);
      $("#net-side").innerHTML = `
        <a href="javascript:void 0" class="small" id="g-home">← All groups</a>
        <div class="eyebrow" style="margin-top:8px">Group</div><h2 style="margin-bottom:6px">${esc(g.label)}</h2>
        <dl class="kv"><dt>Proteins</dt><dd>${fmt(g.count)}</dd><dt>PPIs inside</dt><dd>${fmt(g.ppis)}</dd><dt>Linked groups</dt><dd>${fmt(linked.size)}</dd></dl>
        <h3 style="margin-top:14px">Proteins, most connected first</h3>
        <div style="display:flex;flex-direction:column;gap:3px;font-size:13px">${mem.slice(0, 80).map(([i, d]) => `<a href="javascript:void 0" data-n="${i}" style="display:flex;justify-content:space-between;gap:6px"><span>${esc(net.nodes[i])}</span><span class="muted num">${d} in group</span></a>`).join("")}</div>
        ${mem.length > 80 ? `<div class="small muted" style="margin-top:4px">${fmt(mem.length - 80)} more; search to find them</div>` : ""}
        ${lk.length ? `<h3 style="margin-top:14px">PPIs to other groups</h3><div class="grp-list">${lk.map(([o, n]) => `<a href="javascript:void 0" data-g="${o}"><span class="g">${esc(groups[o].label)}</span><span class="n num">${fmt(n)}</span></a>`).join("")}</div>` : ""}`;
      $("#g-home").onclick = home;
      $$("#net-side [data-n]").forEach((l) => (l.onclick = () => select(+l.dataset.n, true)));
      $$("#net-side [data-g]").forEach((l) => (l.onclick = () => selectGroup(+l.dataset.g)));
      refresh(); fitNodes(members);
    }
    function select(i, fit) {
      if (i == null) return home();
      if (!nodeOk(i, G.getNodeAttributes(i))) { st.org = ""; $("#net-org").value = ""; }
      st.sel = i; st.neigh = new Set(); st.edge = null;
      G.forEachEdge(i, (k, a, s, t) => { if (edgeOk(a)) st.neigh.add(+s === i ? +t : +s); });
      const a = G.getNodeAttributes(i), acc = net.acc[i], gi = groups[a.grp];
      const partners = [...st.neigh].map((o) => {
        const k = G.edge(i, o), ea = G.getEdgeAttributes(k);
        return { o, gene: net.nodes[o], mask: ea.mask, rp: ea.rp };
      }).sort((x, y) => y.rp - x.rp || x.gene.localeCompare(y.gene));
      const subBtn = sub && sub.center === i ? "" : `<button class="btn small primary" id="net-open-sub">${sub ? "Centre residue view here" : "Open residue view →"}</button>`;
      $("#net-side").innerHTML = `
        <a href="javascript:void 0" class="small" id="p-back">${st.grp != null ? `← Group: ${esc(groups[st.grp].label)}` : "← Whole network"}</a>
        <div class="eyebrow" style="margin-top:8px">Selected</div><h2 style="margin-bottom:4px">${esc(a.label)}</h2>
        ${gi ? `<div class="small muted" style="margin-bottom:6px">group: <a href="javascript:void 0" id="p-grp">${esc(gi.label)}</a></div>` : ""}
        <div class="chips" style="margin-bottom:10px">${App.orgChips(a.loc.join(";"))}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${subBtn}${acc && App.idx.byAcc.has(acc) ? `<a class="btn small" href="#/protein/${esc(acc)}">Open protein page →</a>` : ""}</div>
        ${subBtn && !sub ? `<div class="small muted" style="margin-top:4px">sequence bars with the cross-linked residues · or double-click the protein</div>` : ""}
        <h3 style="margin-top:14px">${partners.length} partners shown</h3>
        <div class="small muted" style="margin:-4px 0 6px">Click a partner to see the cross-linked residues.</div>
        <div style="display:flex;flex-direction:column;gap:3px;font-size:13px">${partners.slice(0, 150).map((p) => `<a href="javascript:void 0" data-n="${p.o}" style="display:flex;justify-content:space-between;gap:6px"><span>${esc(p.gene)}</span><span>${App.srcBadges(p.mask)}${p.rp ? `<span class="muted num"> ${p.rp}</span>` : ""}</span></a>`).join("")}</div>`;
      $$("#net-side [data-n]").forEach((l) => (l.onclick = () => showEdge(i, +l.dataset.n)));
      $("#p-back").onclick = back;
      const pg = $("#p-grp"); if (pg) pg.onclick = () => selectGroup(a.grp);
      const ob = $("#net-open-sub"); if (ob) ob.onclick = () => openSub(i);
      refresh();
      if (fit && !sub) fitNodes([st.sel, ...st.neigh]);
    }
    // residue pairs behind one edge: both sequences as bars, each cross-link as a line between its two lysines
    async function showEdge(i, o) {
      const k = G.edge(i, o); if (k == null) return;
      if (st.sel !== i && st.sel !== o) select(i);
      st.edge = k; refresh();
      const ea = G.getEdgeAttributes(k), A = net.acc[i], B = net.acc[o], gA = net.nodes[i], gB = net.nodes[o];
      const side = $("#net-side");
      const head = `<a href="javascript:void 0" id="edge-back" class="small">← ${esc(net.nodes[st.sel])} partners</a>
        <div class="eyebrow" style="margin-top:8px">Interaction</div><h2 style="margin-bottom:4px">${esc(gA)} – ${esc(gB)}</h2>
        <div style="margin-bottom:8px">${App.srcBadges(ea.mask)}</div>`;
      const pageBtns = [[A, gA], [B, gB]].filter(([a]) => a && App.idx.byAcc.has(a))
        .map(([a, g]) => `<a class="btn small" href="#/protein/${esc(a)}">Interface map of ${esc(g)} →</a>`).join(" ");
      const wire = () => { const b = $("#edge-back"); if (b) b.onclick = () => select(st.sel); };
      if (!App.isOriginal(ea.mask)) {
        const e = net.edges[k];
        side.innerHTML = head + `<p class="small">No residue-level evidence: this edge was added by triadic closure because ${esc(App.srcText(ea.mask))} reports it and both proteins share DUC-XL-MS neighbours${e?.[5] ? ` (${esc(e[5])})` : ""}.</p><div style="display:flex;flex-wrap:wrap;gap:6px">${pageBtns}</div>`;
        return wire();
      }
      side.innerHTML = head + `<div class="loading">Loading residue pairs…</div>`; wire();
      const det = A ? await App.details(A) : null;
      if (st.edge !== k) return;
      const pairs = (det?.xl || []).filter((x) => x[0] === B && x[3] & st.src & 3).sort((x, y) => x[1] - y[1]);
      const LA = App.prot(A)?.len || Math.max(10, ...pairs.map((x) => x[1])), LB = App.prot(B)?.len || Math.max(10, ...pairs.map((x) => x[2]));
      const W = 300, x0 = 8, x1 = W - 8, Xa = (r) => x0 + ((r - 0.5) / LA) * (x1 - x0), Xb = (r) => x0 + ((r - 0.5) / LB) * (x1 - x0);
      let s = `<text x="${x0}" y="12" font-size="11" font-weight="700" style="fill:var(--ink)">${esc(gA)}</text><text x="${x1}" y="12" font-size="10" text-anchor="end" style="fill:var(--muted)">1–${LA}</text>
        <rect x="${x0}" y="20" width="${x1 - x0}" height="6" rx="3" fill="var(--border)"/>
        <rect x="${x0}" y="104" width="${x1 - x0}" height="6" rx="3" fill="var(--border)"/>
        <text x="${x0}" y="126" font-size="11" font-weight="700" style="fill:var(--ink)">${esc(gB)}</text><text x="${x1}" y="126" font-size="10" text-anchor="end" style="fill:var(--muted)">1–${LB}</text>`;
      for (const x of pairs) {
        const tip = `${esc(gA)} <b>K${x[1]}</b> ↔ ${esc(gB)} <b>K${x[2]}</b><br>${viz.CELL_LABELS[x[3]]}`;
        s += `<line x1="${Xa(x[1])}" y1="26" x2="${Xb(x[2])}" y2="104" stroke="${viz.CELL_COLORS[x[3]]}" stroke-width="1.6" stroke-opacity=".8" data-tip="${tip}"/>
          <circle cx="${Xa(x[1])}" cy="23" r="3.5" fill="${viz.CELL_COLORS[x[3]]}" data-tip="${tip}"/><circle cx="${Xb(x[2])}" cy="107" r="3.5" fill="${viz.CELL_COLORS[x[3]]}" data-tip="${tip}"/>`;
      }
      side.innerHTML = head + `<h3>${fmt(pairs.length)} cross-linked residue pair${pairs.length === 1 ? "" : "s"}</h3>
        <svg viewBox="0 0 ${W} 134" width="100%" role="img">${s}</svg>
        <div class="tbl-wrap" style="max-height:220px;margin:8px 0 10px"><table><thead><tr><th>${esc(gA)}</th><th>${esc(gB)}</th><th>Cell line</th></tr></thead><tbody>${
          pairs.map((x) => `<tr><td class="mono">K${x[1]}</td><td class="mono">K${x[2]}</td><td>${viz.CELL_LABELS[x[3]]}</td></tr>`).join("")}</tbody></table></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${pageBtns}</div>`;
      wire();
    }

    /* ── residue view (d3) ── */
    let sub = null, pairData = null;
    const barSet = new Set();
    const nodeR = (d) => Math.min(14, 5 + Math.sqrt(d.deg) * 0.55);
    const seqLen = (d) => d.len || d.maxres || 1;
    const barW = (d) => Math.max(90, Math.min(480, seqLen(d) * 0.35));
    const lx = (d, res) => -d.w / 2 + (Math.min(res, seqLen(d)) - 1) / Math.max(1, seqLen(d) - 1) * d.w;
    const pairColor = (m) => viz.CELL_COLORS[m] || App.cssVar("--muted");
    async function openSub(center) {
      if (!pairData) { $("#net-hint").textContent = "Loading residue pairs…"; pairData = await App.load("network_pairs"); }
      if (sub) sub.sim.stop();
      const cells = st.src & 3, nodes = [], byKey = new Map();
      const add = (i) => {
        const acc = net.acc[i], a = G.getNodeAttributes(i);
        const d = { i, gene: net.nodes[i], acc, len: acc ? App.prot(acc)?.len : null, color: a.color, deg: net.adj[i].length, bar: barSet.has(i), maxres: 1,
          x: (a.x - G.getNodeAttribute(center, "x")) * 2600 + (Math.random() - 0.5) * 20, y: -(a.y - G.getNodeAttribute(center, "y")) * 2600 + (Math.random() - 0.5) * 20 };
        d.r = i === center ? 13 : nodeR(d); nodes.push(d); byKey.set(i, d); return d;
      };
      const c = add(center); c.fx = 0; c.fy = 0;
      G.forEachEdge(center, (k, a, s, t) => { const o = +s === center ? +t : +s; if (edgeOk(a) && nodeOk(o, G.getNodeAttributes(o)) && !byKey.has(o)) add(o); });
      const allowPP = $("#sub-pp").checked, links = []; let dropped = 0;
      G.forEachEdge((k, a, s, t) => {
        if (!byKey.has(+s) || !byKey.has(+t) || !edgeOk(a)) return;
        const isC = +s === center || +t === center;
        if (!isC && !allowPP) { dropped++; return; }
        const e = net.edges[k], orig = (a.mask & cells) !== 0;
        const pairs = orig ? (pairData.inter[k] || []).filter((p) => p[2] & cells) : [];
        links.push({ k: +k, source: byKey.get(e[0]), target: byKey.get(e[1]), pairs, aug: !orig, center: isC, mask: a.mask });
      });
      if (links.length > 5000) { const keep = links.filter((l) => l.center); dropped += links.length - keep.length; links.length = 0; links.push(...keep); }
      links.forEach((l) => l.pairs.forEach((p) => { l.source.maxres = Math.max(l.source.maxres, p[0]); l.target.maxres = Math.max(l.target.maxres, p[1]); }));
      nodes.forEach((d) => { d.intra = (pairData.intra[d.i] || []).filter((p) => p[2] & cells); d.intra.forEach((p) => { d.maxres = Math.max(d.maxres, p[0], p[1]); }); d.w = barW(d); });

      const svg = d3.select("#net-sub"); svg.selectAll("*").remove(); svg.classed("many", nodes.length > 150);
      const g = svg.append("g");
      const zoom = d3.zoom().scaleExtent([0.08, 8]).on("zoom", (ev) => g.attr("transform", ev.transform));
      svg.call(zoom).on("dblclick.zoom", null);
      const linkSel = g.append("g").selectAll("g").data(links).join("g").attr("class", (l) => "lk" + (l.aug ? " aug" : ""))
        .on("click", (ev, l) => { ev.stopPropagation(); showEdge(l.source.i, l.target.i); });
      linkSel.append("title").text((l) => `${l.source.gene} – ${l.target.gene}: ` + (l.aug ? `augmented (${App.srcText(l.mask)}), no residue pairs` : `${l.pairs.length} residue pair${l.pairs.length === 1 ? "" : "s"}`));
      const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).distance((l) => (l.center ? 120 : 80) + (l.source.bar ? l.source.w / 3 : 0) + (l.target.bar ? l.target.w / 3 : 0)).strength((l) => (l.center ? 0.5 : 0.12)))
        .force("charge", d3.forceManyBody().strength(nodes.length > 200 ? -50 : -180))
        .force("collide", d3.forceCollide().radius((d) => (d.bar ? d.w / 2 + 14 : d.r + 8)).iterations(2))
        .force("x", d3.forceX().strength(0.02)).force("y", d3.forceY().strength(0.02));
      let clickTimer = null;
      const nodeSel = g.append("g").selectAll("g").data(nodes).join("g").attr("class", "node")
        .call(d3.drag().on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on("end", (ev, d) => { if (!ev.active) sim.alphaTarget(0); if (d.i !== center) { d.fx = null; d.fy = null; } }))
        .on("click", (ev, d) => { ev.stopPropagation(); clearTimeout(clickTimer); clickTimer = setTimeout(() => select(d.i), 220); })
        .on("dblclick", (ev, d) => { ev.stopPropagation(); clearTimeout(clickTimer); toggleBar(d); });
      svg.on("click", () => { if (st.edge != null || st.sel !== center) select(center); });
      sub = { center, nodes, links, sim, svg, zoom, nodeSel, linkSel };
      nodeSel.each(function (d) { drawSubNode(d3.select(this), d); });
      sim.on("tick", subTick);
      $("#net-sub").removeAttribute("hidden"); $("#net-subbar").hidden = false; $("#sigma").style.visibility = "hidden"; $("#net-count").hidden = true;
      $("#net-hint").textContent = "Drag proteins · scroll to zoom";
      $("#sub-info").textContent = `${net.nodes[center]}: ${fmt(nodes.length - 1)} partners, ${fmt(links.length)} links` + (dropped ? ` (${fmt(dropped)} links among partners not drawn)` : "");
      subFit();
      select(center);
    }
    function subFit() {
      if (!sub) return;
      const b = $("#net-sub").getBoundingClientRect(), n = sub.nodes.length, bars = sub.nodes.filter((d) => d.bar).length;
      const k = (n > 300 ? 0.35 : n > 120 ? 0.55 : n > 40 ? 0.8 : 1) * (bars > n / 2 ? 0.6 : 1);
      sub.svg.transition().duration(350).call(sub.zoom.transform, d3.zoomIdentity.translate(b.width / 2, b.height / 2).scale(k));
    }
    function closeSub() {
      if (!sub) return;
      sub.sim.stop(); sub = null;
      $("#net-sub").setAttribute("hidden", ""); $("#net-subbar").hidden = true; $("#sigma").style.visibility = ""; $("#net-count").hidden = false;
      $("#net-hint").textContent = HINT;
      renderer.resize(); select(st.sel, true);
    }
    function relayout() {
      const fl = sub.sim.force("link"), fc = sub.sim.force("collide"); fl.distance(fl.distance()); fc.radius(fc.radius());
    }
    function toggleBar(d) {
      d.bar = !d.bar; if (d.bar) barSet.add(d.i); else barSet.delete(d.i);
      sub.nodeSel.filter((x) => x === d).each(function (x) { drawSubNode(d3.select(this), x); });
      relayout(); sub.sim.alpha(0.5).restart();
    }
    function setAllBars(flag) {
      if (!sub) return;
      sub.nodes.forEach((d) => { d.bar = flag; if (flag) barSet.add(d.i); else barSet.delete(d.i); });
      sub.nodeSel.each(function (d) { drawSubNode(d3.select(this), d); });
      relayout(); sub.sim.force("charge").strength(flag ? (sub.nodes.length > 200 ? -120 : -400) : (sub.nodes.length > 200 ? -50 : -180));
      sub.sim.alpha(0.8).restart(); subFit();
    }
    function drawSubNode(sel, d) {
      sel.selectAll("*").remove(); sel.classed("bar", d.bar);
      sel.append("title").text(`${d.gene}${d.acc ? " · " + d.acc : ""}${d.len ? " · " + d.len + " aa" : ""} · ${d.deg} partners`);
      if (!d.bar) {
        sel.append("circle").attr("r", d.r).style("fill", d.color);
        sel.append("text").attr("y", d.r + 12).attr("text-anchor", "middle").text(d.gene);
        return;
      }
      const w = d.w;
      // intra-protein cross-links as arcs above the bar
      d.intra.forEach((p) => {
        const x1 = lx(d, p[0]), x2 = lx(d, p[1]), h = Math.min(60, 8 + Math.abs(x2 - x1) * 0.4);
        sel.append("path").attr("class", "arc").style("stroke", pairColor(p[2])).attr("d", `M${x1.toFixed(1)} -8 Q${((x1 + x2) / 2).toFixed(1)} ${(-8 - h).toFixed(1)} ${x2.toFixed(1)} -8`);
      });
      sel.append("rect").attr("class", "seq").attr("x", -w / 2).attr("y", -8).attr("width", w).attr("height", 16).attr("rx", 3);
      // cross-linked lysines as ticks
      const ticks = new Map();
      sub.links.forEach((l) => {
        if (l.source === d) l.pairs.forEach((p) => ticks.set(p[0], (ticks.get(p[0]) || 0) | p[2]));
        if (l.target === d) l.pairs.forEach((p) => ticks.set(p[1], (ticks.get(p[1]) || 0) | p[2]));
      });
      ticks.forEach((m, res) => { sel.append("rect").attr("x", lx(d, res) - 1).attr("y", -8).attr("width", 2).attr("height", 16).style("fill", pairColor(m)).append("title").text(`K${res}`); });
      sel.append("text").attr("class", "seqname").attr("x", -w / 2).attr("y", -14).text(d.gene);
      sel.append("text").attr("class", "seqlbl").attr("x", -w / 2).attr("y", 20).text("1");
      sel.append("text").attr("class", "seqlbl").attr("x", w / 2).attr("y", 20).attr("text-anchor", "end").text(d.len ? d.len + " aa" : "max residue " + seqLen(d));
    }
    function subTick() {
      if (!sub) return;
      sub.nodeSel.attr("transform", (d) => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
      sub.linkSel.each(function (l) {
        const sel = d3.select(this), S = l.source, T = l.target;
        if ((!S.bar && !T.bar) || l.aug) {
          // one line per protein pair: centre to centre
          sel.selectAll("line").data([l]).join("line").style("stroke", l.aug ? null : pairColor(l.mask & 3))
            .attr("x1", S.x).attr("y1", S.y).attr("x2", T.x).attr("y2", T.y);
        } else {
          // one line per residue pair: lysine to lysine
          sel.selectAll("line").data(l.pairs).join("line").style("stroke", (p) => pairColor(p[2]))
            .attr("x1", (p) => (S.bar ? S.x + lx(S, p[0]) : S.x)).attr("y1", () => (S.bar ? S.y + (T.y > S.y ? 8 : -8) : S.y))
            .attr("x2", (p) => (T.bar ? T.x + lx(T, p[1]) : T.x)).attr("y2", () => (T.bar ? T.y + (S.y > T.y ? 8 : -8) : T.y));
        }
      });
    }
    function subHighlight() {
      if (!sub) return;
      sub.nodeSel.classed("sel", (d) => d.i === st.sel).classed("center", (d) => d.i === sub.center);
      sub.linkSel.classed("sel", (l) => l.k === st.edge).classed("faded", (l) => st.sel != null && l.source.i !== st.sel && l.target.i !== st.sel && l.k !== st.edge);
    }
    $("#sub-back").onclick = closeSub;
    $("#sub-pp").onchange = () => { if (sub) openSub(sub.center); };
    $("#sub-bars").onclick = () => setAllBars(true);
    $("#sub-nodes").onclick = () => setAllBars(false);

    /* full screen */
    const layout = $("#net-layout");
    const setFull = (on) => { layout.classList.toggle("is-full", on); $("#net-fs").textContent = on ? "✕ Exit full screen" : "⛶ Full screen"; renderer.resize(); renderer.refresh(); if (sub) subFit(); };
    $("#net-fs").onclick = () => setFull(!layout.classList.contains("is-full"));
    // Esc goes up one level; on the whole network it leaves full screen
    const onKey = (e) => {
      if (e.key !== "Escape" || e.target.closest?.("input, select, textarea")) return;
      if (sub || st.sel != null || st.grp != null) back(); else if (layout.classList.contains("is-full")) setFull(false);
    };
    $("#net-back").onclick = back;
    document.addEventListener("keydown", onKey);

    App.bindTips($("#net-side"));
    // hovering an edge shows its residue-pair count
    let lastMouse = null;
    $("#sigma").addEventListener("mousemove", (e) => { lastMouse = e; App.tipMove(e); });
    renderer.on("enterEdge", ({ edge }) => {
      $("#sigma").style.cursor = "pointer";
      const a = G.getEdgeAttributes(edge), [s, t] = G.extremities(edge);
      const txt = App.isOriginal(a.mask)
        ? `residue pairs: HEK293 ${fmt(a.h)} · Jurkat ${fmt(a.j)}`
        : `augmented (${esc(App.srcText(a.mask))}): no residue pairs`;
      App.tipShow(`<b>${esc(net.nodes[+s])} – ${esc(net.nodes[+t])}</b><br>${txt}`, lastMouse);
    });
    renderer.on("leaveEdge", () => { $("#sigma").style.cursor = ""; App.tipHide(); });
    renderer.on("clickEdge", ({ edge }) => { const [s, t2] = G.extremities(edge); const a = +s, b = +t2; showEdge(st.sel === b ? b : a, st.sel === b ? a : b); });
    renderer.on("clickNode", ({ node }) => {
      const a = G.getNodeAttributes(node);
      if (a.kind === "m") selectGroup(a.gid); else select(+node, true);
    });
    renderer.on("doubleClickNode", ({ node, event }) => {
      event.preventSigmaDefault();
      if (G.getNodeAttribute(node, "kind") === "m") return;
      const n = +node, center = st.sel != null && st.neigh.has(n) ? st.sel : n;
      barSet.add(n); openSub(center);
    });
    renderer.on("clickStage", back);
    renderer.on("enterNode", () => { $("#sigma").style.cursor = "pointer"; });
    renderer.on("leaveNode", () => { $("#sigma").style.cursor = ""; });
    const reapply = () => { if (sub) openSub(sub.center); else if (st.sel != null) select(st.sel); else refresh(); };
    $("#net-glab").onchange = (e) => { st.glab = e.target.checked; renderer.refresh(); };
    $("#net-cross").onchange = (e) => { st.cross = e.target.checked; refresh(); };
    $$("#net-src input").forEach((c) => (c.onchange = () => { st.src = $$("#net-src input").reduce((s, i) => s | (i.checked ? +i.value : 0), 0); reapply(); }));
    $("#net-rp").oninput = (e) => { st.rp = +e.target.value; $("#net-rp-v").textContent = st.rp; reapply(); };
    $("#net-org").onchange = (e) => { st.org = e.target.value; reapply(); };
    $("#net-q").onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const acc = App.resolve(e.target.value);
      let i = acc != null ? net.nodeOfAcc.get(acc) : null;
      if (i == null) i = net.nodes.findIndex((g) => g.toUpperCase() === e.target.value.trim().toUpperCase());
      if (i != null && i >= 0) { if (sub) openSub(i); else select(i, true); } else e.target.setCustomValidity("Not in the network"), e.target.reportValidity(), setTimeout(() => e.target.setCustomValidity(""), 1500);
    };
    const onTheme = () => { palette(); renderer.setSetting("labelColor", { color: App.cssVar("--ink") }); refresh(); };
    window.addEventListener("themechange", onTheme);
    unmount(() => { if (sub) sub.sim.stop(); renderer.kill(); App.tipHide(); window.removeEventListener("themechange", onTheme); document.removeEventListener("keydown", onKey); });
    home();
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
        <div class="card-sub">Experimental reference structure. Subunits use the colour of their human counterpart in the model above.</div>
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
      { key: "mask", label: "Augmented from", value: (r) => App.srcText(r.mask), render: (r) => App.srcBadges(r.mask) },
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
        <div class="card"><h2>Data download</h2>
          <dl class="kv dl-list">
            <dt><a href="downloads/DUC-XL-MS_crosslinks_and_PPIs.xlsx" download>Cross-links and PPIs ↓</a></dt><dd>Residue-pair cross-links and protein–protein interactions, HEK293 and Jurkat (1% FDR) · 12 MB</dd>
            <dt><a href="downloads/DUC-XL-MS_organelle_topology_markers.xlsx" download>Organelle and topology markers ↓</a></dt><dd>Curated marker proteins used for localization and topology · 1.1 MB</dd>
            <dt><a href="downloads/DUC-XL-MS_localization_topology_contacts.xlsx" download>Localization, topology, contact sites ↓</a></dt><dd>Propagated localization, membrane-loop topology and contact-site candidates · 0.2 MB</dd>
            <dt><a href="downloads/DUC-XL-MS_SLiM_candidates.xlsx" download>SLiM candidates ↓</a></dt><dd>AlphaFold3 short-linear-motif candidates · 0.1 MB</dd>
            <dt><a href="downloads/DUC-XL-MS_augmented_core_interactome.xlsx" download>Augmented core interactome ↓</a></dt><dd>Core interactome with triadic-closure augmented edges · 1.0 MB</dd>
          </dl></div>
        <div class="card"><h2>Reading the views</h2>
          <ul style="padding-left:18px;margin:0;color:var(--ink-2)">
            <li>Organelle colours use Paul Tol's colour-blind-safe "muted" scheme; every colour is also named in a legend or label.</li>
            <li>Network edges: solid = cross-linked in DUC-XL-MS; grey/dashed = augmented from another resource.</li>
          </ul></div>
        <div class="card"><h2>Code &amp; data</h2>
          <dl class="kv">
            <dt>GitHub</dt><dd><a href="${GH}" target="_blank" rel="noopener">zhangzh-orange/DUC-XL-MS ↗</a> — figure-reproduction notebooks, the XL_MOPLC assembly pipeline and analysis modules (organelle-label propagation, membrane-topology assignment, ipSAE SLiM screen, triadic-closure augmentation). MIT licence.</dd>
            <dt>PRIDE</dt><dd>HEK293 <span class="mono">PXD081158</span> · Jurkat <span class="mono">PXD081113</span> (ProteomeXchange)</dd>
            <dt>Code questions</dt><dd><a href="${GH}/issues" target="_blank" rel="noopener">GitHub issues ↗</a></dd>
          </dl>
          <h3 style="margin-top:12px">Citation</h3>
<pre class="bib">@article{zhang2026ducxlms,
  title  = {Site-resolved spatial and structural interactome of a human cell},
  author = {Zhang, Zehong and Yokoyama, Nanako and Zhu, Ying and Ruta, Julia and
            Cheng, Jiale and Natalia, Vini and Soykan, Tolga and Haucke, Volker and Liu, Fan},
  year   = {2026}
}</pre></div>
      </section>${footer()}`;
  };
})();
