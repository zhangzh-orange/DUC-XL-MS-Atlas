/* DUC-XL-MS Atlas — reusable visual components (canvas map, SVG tracks, bars). */
"use strict";
(function () {
  const { esc, fmt } = App;
  const V = (App.viz = {});
  // Cell-line encoding for residue-level views (Tol bright)
  V.CELL_COLORS = { 1: "#4477AA", 2: "#228833", 3: "#AA3377" };
  V.CELL_LABELS = { 1: "HEK293 only", 2: "Jurkat only", 3: "Both cell lines" };
  V.AGREE_COLORS = { agree: "var(--ok)", novel: "var(--accent)", conflict: "var(--bad)" };

  /* ── cell map: organelle-anchored layout drawn on canvas ─────────────── */
  V.cellMap = function (host, net, opts = {}) {
    host.style.position = "relative";
    host.innerHTML = `<canvas style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair"></canvas>`;
    const cv = host.firstChild, ctx = cv.getContext("2d");
    const n = net.nodes.length;
    const col = new Array(n), col2 = new Array(n), loc = new Array(n);
    for (let i = 0; i < n; i++) {
      loc[i] = App.locList(App.nodeLoc(net, i));
      col[i] = loc[i][0] ? App.orgColor(loc[i][0]) : null;
      col2[i] = loc[i][1] ? App.orgColor(loc[i][1]) : null;
    }
    let W = 0, H = 0, scale = 1, ox = 0, oy = 0, hover = -1;
    const xs = net.xy.map((p) => p[0]), ys = net.xy.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const px = (i) => ox + (net.xy[i][0] - minX) * scale;
    const py = (i) => oy + (maxY - net.xy[i][1]) * scale;
    const focus = opts.focus ? new Set(opts.focus) : null;

    function resize() {
      const r = host.getBoundingClientRect(), d = devicePixelRatio || 1;
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      scale = Math.min((W - 24) / (maxX - minX), (H - 24) / (maxY - minY));
      ox = (W - (maxX - minX) * scale) / 2; oy = (H - (maxY - minY) * scale) / 2;
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const surface = App.cssVar("--surface"), muted = App.cssVar("--aug");
      if (opts.edges !== false) {
        ctx.strokeStyle = App.cssVar("--edge"); ctx.lineWidth = 0.5; ctx.beginPath();
        for (const e of net.edges) {
          if (focus && !(focus.has(e[0]) || focus.has(e[1]))) continue;
          ctx.moveTo(px(e[0]), py(e[0])); ctx.lineTo(px(e[1]), py(e[1]));
        }
        ctx.stroke();
      }
      const r = Math.max(1.6, Math.min(3.2, scale / 160));
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const has = !!col[i];
          if ((pass === 0) === has) continue;  // unassigned first, organelles on top
          const dim = focus && !focus.has(i);
          ctx.globalAlpha = dim ? 0.15 : has ? 0.95 : 0.45;
          ctx.fillStyle = has ? col[i] : muted;
          ctx.beginPath(); ctx.arc(px(i), py(i), has ? r : r * 0.8, 0, 6.2832); ctx.fill();
          if (col2[i] && !dim) { ctx.strokeStyle = col2[i]; ctx.lineWidth = 1.2; ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
      if (focus) for (const i of focus) {
        ctx.fillStyle = col[i] || muted; ctx.strokeStyle = App.cssVar("--ink"); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px(i), py(i), r + 2, 0, 6.2832); ctx.fill(); ctx.stroke();
      }
      // direct organelle labels at the median of each compartment's nodes
      if (opts.labels !== false) {
        ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
        for (const c of App.meta.compartments) {
          const ids = []; for (let i = 0; i < n; i++) if (loc[i][0] === c && loc[i].length === 1) ids.push(i);
          if (ids.length < 8) continue;
          const mx = median(ids.map(px)), my = median(ids.map(py));
          const t = App.orgLabel(c);
          ctx.lineWidth = 4; ctx.strokeStyle = surface; ctx.strokeText(t, mx, my - 14);
          ctx.fillStyle = App.cssVar("--ink"); ctx.fillText(t, mx, my - 14);
        }
      }
      if (hover >= 0) {
        ctx.strokeStyle = App.cssVar("--ink"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px(hover), py(hover), r + 3, 0, 6.2832); ctx.stroke();
      }
    }
    function nearest(ev) {
      const b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top;
      let best = -1, bd = 64;
      for (let i = 0; i < n; i++) { const d = (px(i) - x) ** 2 + (py(i) - y) ** 2; if (d < bd) { bd = d; best = i; } }
      return best;
    }
    cv.addEventListener("mousemove", (ev) => {
      const i = nearest(ev);
      if (i !== hover) { hover = i; draw(); }
      if (i < 0) return App.tipHide();
      const l = loc[i].map(App.orgLabel).join(" · ") || "Unassigned";
      const deg = net.adj[i].length;
      App.tipShow(`<b>${esc(net.nodes[i])}</b><br>${esc(l)}<br><span class="muted">${deg} interactions · click to open</span>`, ev);
    });
    cv.addEventListener("mouseleave", () => { hover = -1; draw(); App.tipHide(); });
    cv.addEventListener("click", (ev) => {
      const i = nearest(ev); if (i < 0) return;
      if (opts.onClick) opts.onClick(i);
      else if (net.acc[i]) location.hash = `#/protein/${net.acc[i]}`;
    });
    const ro = new ResizeObserver(resize); ro.observe(host);
    const th = () => draw(); window.addEventListener("themechange", th);
    return { destroy() { ro.disconnect(); window.removeEventListener("themechange", th); } };
  };
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

  /* ── SVG helpers ─────────────────────────────────────────────────────── */
  const svg = (w, h, inner, cls = "") => `<svg viewBox="0 0 ${w} ${h}" width="100%" class="${cls}" role="img" preserveAspectRatio="xMinYMin meet">${inner}</svg>`;
  const ticks = (L, n = 6) => {
    const step = niceStep(L / n), out = [];
    for (let v = 0; v <= L; v += step) out.push(v || 1);
    return out;
  };
  const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)); const m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

  /* ── sequence track: cross-links, loops and motifs along the sequence ── */
  V.seqTrack = function (host, acc, det, len, cells = 3) {
    const xl = (det?.xl || []).filter((x) => x[3] & cells);
    const L = len || Math.max(10, ...xl.map((x) => x[1]), ...(det?.loops || []).map((l) => +String(l["Loop Range"]).split("-")[0] || 0));
    const W = 1000, padL = 36, padR = 16, innerW = W - padL - padR;
    const X = (r) => padL + (Math.min(r, L) / L) * innerW;
    const intra = xl.filter((x) => x[0] === acc), inter = xl.filter((x) => x[0] !== acc);
    const arcH = 110, barY = arcH + 22, H = barY + 92;
    let s = "";
    // intra arcs
    const maxSpan = Math.max(1, ...intra.map((x) => Math.abs(x[2] - x[1])));
    for (const x of intra.slice(0, 2500)) {
      const a = X(Math.min(x[1], x[2])), b = X(Math.max(x[1], x[2]));
      const h = 8 + (arcH - 12) * Math.sqrt(Math.abs(x[2] - x[1]) / maxSpan);
      s += `<path d="M${a},${barY - 6} C${a},${barY - 6 - h} ${b},${barY - 6 - h} ${b},${barY - 6}" fill="none" stroke="${V.CELL_COLORS[x[3]]}" stroke-width="1" stroke-opacity=".55" data-tip="Intra-link K${x[1]}–K${x[2]}<br>${V.CELL_LABELS[x[3]]}"/>`;
    }
    // loops (membrane topology) and motifs as background bands
    for (const l of det?.loops || []) {
      const [a, b] = String(l["Loop Range"]).split("-");
      const ra = +a || 1, rb = b === "Ct" ? L : +b || L;
      s += `<rect x="${X(ra)}" y="${barY - 4}" width="${Math.max(2, X(rb) - X(ra))}" height="8" rx="2" fill="${l["Assigned Side"] === "CYT" ? "#88CCEE" : "#DDAA33"}" opacity=".9" data-tip="${esc(V.regionName(l["Loop ID"]))} · residues ${ra}–${rb}<br>DUC-XL-MS: <b>${esc(V.SIDE_NAMES[l["Assigned Side"]] || l["Assigned Side"])}</b> · UniProt: ${esc(V.SIDE_NAMES[l["UniProt Side"]] || "not annotated")}<br>${esc(l.Agreement)}"/>`;
    }
    s += `<rect x="${padL}" y="${barY - 2}" width="${innerW}" height="4" rx="2" fill="var(--border)"/>`;
    for (const m of det?.slims || []) {
      const a = X(m["Start Residue"]), b = X(m["End Residue"]);
      s += `<rect x="${a}" y="${barY + 8}" width="${Math.max(3, b - a)}" height="9" rx="2" fill="#EE7733" data-tip="SLiM ${m["Start Residue"]}–${m["End Residue"]} → ${esc(m["Partner Gene Symbol"])}<br><span class='mono'>${esc(m["Motif Sequence"])}</span><br>ΔpLDDT ${m.dpLDDT} · ipSAE ${m["Max ipSAE"]}"/>`;
    }
    // inter-link ticks aggregated by residue
    const byRes = new Map();
    for (const x of inter) { if (!byRes.has(x[1])) byRes.set(x[1], []); byRes.get(x[1]).push(x); }
    const maxN = Math.max(1, ...[...byRes.values()].map((v) => v.length));
    for (const [r, v] of byRes) {
      const m = v.reduce((o, x) => o | x[3], 0);
      const h = 8 + 44 * Math.sqrt(v.length / maxN);
      const partners = [...new Set(v.map((x) => App.geneOf(x[0])))];
      s += `<line x1="${X(r)}" x2="${X(r)}" y1="${barY + 20}" y2="${barY + 20 + h}" stroke="${V.CELL_COLORS[m]}" stroke-width="2" stroke-linecap="round" data-tip="K${r}: ${v.length} inter-link(s)<br>${esc(partners.slice(0, 12).join(", "))}${partners.length > 12 ? "…" : ""}"/>`;
    }
    // axis
    for (const t of ticks(L)) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${H - 14}" y2="${H - 10}" stroke="var(--border)"/><text x="${X(t)}" y="${H - 1}" font-size="10" text-anchor="middle">${t}</text>`;
    s += `<text x="0" y="${barY - arcH / 2}" font-size="10">intra</text><text x="0" y="${barY + 44}" font-size="10">inter</text>`;
    host.innerHTML = svg(W, H, s);
    return { nIntra: intra.length, nInter: inter.length, L };
  };

  /* ── membrane topology diagram ───────────────────────────────────────── */
  // Side codes used by DUC-XL-MS, named with UniProt topological-domain terms
  V.SIDE_NAMES = { CYT: "Cytoplasmic", LUM: "Lumenal / extracellular", IMS: "Mitochondrial intermembrane", MTX: "Mitochondrial matrix", PXM: "Peroxisomal matrix" };
  V.SIDE_COLORS = { top: "#88CCEE", bottom: "#DDAA33" };
  const UP_SIDE = (note) => {
    const n = (note || "").toLowerCase();
    if (n.startsWith("cytoplasmic") || n.startsWith("mother cell cytoplasmic")) return "CYT";
    if (n.includes("intermembrane")) return "IMS";
    if (n.includes("matrix") && n.includes("mito")) return "MTX";
    if (n.startsWith("peroxisomal")) return "PXM";
    if (n) return "LUM";
    return null;
  };
  // Loop IDs (Nt, L1…, Ct) are the topological domains delimited by UniProt TRANSMEM features
  V.regionName = (id) => id === "Nt" ? "N-terminal domain" : id === "Ct" ? "C-terminal domain"
    : /^L(\d+)$/.test(id) ? `Domain between TM${+id.slice(1)} and TM${+id.slice(1) + 1}` : id;
  V.loopRange = (l, len) => { const [a, b] = String(l["Loop Range"]).split("-"); return [+a || 1, b === "Ct" ? len : +b]; };

  V.topology = function (host, det, len) {
    const up = det?.uniprot, L = up?.len || len;
    const loops = det?.loops || [];
    if (!loops.length || !L) { host.innerHTML = ""; return false; }
    const tms = up?.tm?.length ? up.tm : [];
    // regions between UniProt TM helices: Nt, L1 … L(n-1), Ct
    const regs = [];
    if (!tms.length) regs.push({ id: "Nt", a: 1, b: L });
    else {
      regs.push({ id: "Nt", a: 1, b: tms[0][0] - 1 });
      for (let k = 1; k < tms.length; k++) regs.push({ id: `L${k}`, a: tms[k - 1][1] + 1, b: tms[k][0] - 1 });
      regs.push({ id: "Ct", a: tms[tms.length - 1][1] + 1, b: L });
    }
    const byId = Object.fromEntries(loops.map((l) => [l["Loop ID"], l]));
    for (const r of regs) {
      r.xl = byId[r.id] || null;
      const mid = (r.a + r.b) / 2, dom = (up?.dom || []).find((d) => d[0] <= mid && mid <= d[1]);
      r.upNote = dom ? dom[2] : null; r.upSide = dom ? UP_SIDE(dom[2]) : null;
      r.side = r.xl ? r.xl["Assigned Side"] : r.upSide;
      r.kind = r.xl ? "xl" : r.upSide ? "uniprot" : "unknown";
    }
    // fill undetermined regions by alternation from the nearest known region
    regs.forEach((r, i) => {
      if (r.side) return;
      let j = -1, best = 1e9;
      regs.forEach((q, k) => { if (q.side && q.kind !== "inferred" && Math.abs(k - i) < best) { best = Math.abs(k - i); j = k; } });
      if (j < 0) return;
      const flip = Math.abs(j - i) % 2 === 1, s = regs[j].side;
      r.side = flip ? { CYT: "LUM", LUM: "CYT", PXM: "CYT", IMS: "MTX", MTX: "IMS" }[s] : s;
      r.kind = "inferred";
    });
    const sides = new Set(regs.map((r) => r.side).filter(Boolean));
    const topCode = sides.has("MTX") && !sides.has("CYT") ? "IMS" : "CYT";
    const isTop = (s) => s === topCode;
    const bottomCode = [...sides].find((s) => s !== topCode) || (topCode === "IMS" ? "MTX" : "LUM");

    // piecewise x scale: fixed width per TM, regions share the rest (min width each)
    const W = 1000, padL = 30, padR = 30, tmW = 18, minR = 34;
    const usable = W - padL - padR - tms.length * tmW - regs.length * minR;
    const totLen = regs.reduce((s, r) => s + Math.max(1, r.b - r.a + 1), 0);
    let x = padL;
    regs.forEach((r, i) => {
      r.x0 = x; r.x1 = x + minR + Math.max(0, usable) * (Math.max(1, r.b - r.a + 1) / totLen); x = r.x1;
      if (i < tms.length) { tms[i].x0 = x; tms[i].x1 = x + tmW; x += tmW; }
    });
    // extra room above the top line and below the bottom line for the rotated residue-range labels;
    // spacing between the chain lines and the membrane is unchanged
    const mY = 136, mH = 34, topY = mY - 48, botY = mY + mH + 48, upY = botY + 124, H = upY + 30;
    const edge = (top) => (top ? mY : mY + mH);
    const yOf = (top) => (top ? topY : botY);
    const color = (r) => r.kind === "xl" ? (V.AGREE_COLORS[r.xl.Agreement] || "var(--muted)") : "var(--muted)";
    let s = `<rect x="0" y="${mY}" width="${W}" height="${mH}" fill="var(--surface-2)"/>
      <line x1="0" x2="${W}" y1="${mY}" y2="${mY}" stroke="var(--border)"/><line x1="0" x2="${W}" y1="${mY + mH}" y2="${mY + mH}" stroke="var(--border)"/>
      <text x="4" y="14" font-size="11" font-weight="600">${esc(V.SIDE_NAMES[topCode])} side</text>
      <text x="4" y="${botY + 72}" font-size="11" font-weight="600">${esc(V.SIDE_NAMES[bottomCode])} side</text>
      <text x="4" y="${mY + mH / 2 + 4}" font-size="10">membrane</text>`;
    // chain regions
    regs.forEach((r, i) => {
      if (!r.side) return;
      const top = isTop(r.side), y = yOf(top), e = top ? mY - 3 : mY + mH + 3, c = color(r);
      const dash = r.kind === "xl" ? "" : r.kind === "uniprot" ? 'stroke-dasharray="6 4"' : 'stroke-dasharray="2 4"';
      const w = r.kind === "xl" ? 5 : 2;
      // domains join the flanking TM helices at the centre of their top / bottom edge
      const first = i === 0, last = i === regs.length - 1;
      const jl = first ? r.x0 : tms[i - 1].x0 + tmW / 2, jr = last ? r.x1 : tms[i].x0 + tmW / 2;
      const k = Math.min(12, (jr - jl) / 3);
      let d;
      if (first && last) d = `M${jl},${y} L${jr},${y}`;
      else if (first) d = `M${jl},${y} L${jr - k},${y} Q${jr},${y} ${jr},${e}`;
      else if (last) d = `M${jl},${e} Q${jl},${y} ${jl + k},${y} L${jr},${y}`;
      else d = `M${jl},${e} Q${jl},${y} ${jl + k},${y} L${jr - k},${y} Q${jr},${y} ${jr},${e}`;
      const xl = r.xl;
      const tipTxt = `<b>${esc(V.regionName(r.id))}</b> · residues ${r.a}–${r.b}<br>` + (xl
        ? `DUC-XL-MS: <b>${esc(V.SIDE_NAMES[xl["Assigned Side"]] || xl["Assigned Side"])}</b> (${xl["Residue Pair Count"]} residue pairs, purity ${xl.Purity}, ${esc(xl.Confidence)} confidence)<br>UniProt: ${esc(r.upNote || "not annotated")} → <b>${esc(xl.Agreement)}</b>`
        : r.kind === "uniprot" ? `Not assigned by DUC-XL-MS<br>UniProt: ${esc(r.upNote)}` : `Not assigned; side inferred by alternation across TM helices`);
      s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${dash} data-tip="${esc(tipTxt)}"/>
        <path d="${d}" fill="none" stroke="transparent" stroke-width="14" data-tip="${esc(tipTxt)}"/>`;
      const lx = (r.x0 + r.x1) / 2, ly = top ? y - 9 : y + 17, narrow = r.x1 - r.x0 < 64;
      const lab = `${r.a}–${r.b}`;
      s += narrow
        ? `<text x="${lx}" y="${ly}" font-size="9.5" text-anchor="${top ? "start" : "end"}" transform="rotate(-50 ${lx} ${ly})">${lab}</text>`
        : `<text x="${lx}" y="${ly}" font-size="10.5" text-anchor="middle">${lab}</text>`;
    });
    // TM helices (UniProt TRANSMEM)
    tms.forEach((t, i) => {
      const p = regs[i], q = regs[i + 1];
      const same = p?.side && q?.side && isTop(p.side) === isTop(q.side) && p.kind === "xl" && q.kind === "xl";
      const cx = (t.x0 + t.x1) / 2;
      const nm = (t[2].match(/Name=(\w+)/) || [, i + 1])[1];
      const tipTxt = `<b>TM${esc(nm)}</b> (UniProt TRANSMEM) · residues ${t[0]}–${t[1]}${same ? "<br><span style='color:var(--bad)'>Both flanking domains are on the same side — inconsistent with a membrane-spanning helix here</span>" : ""}`;
      s += `<rect x="${t.x0 + 1}" y="${mY - 3}" width="${tmW - 2}" height="${mH + 6}" rx="5" fill="${same ? "var(--surface)" : "var(--ink-2)"}" fill-opacity="${same ? 1 : 0.8}" stroke="${same ? "var(--bad)" : "none"}" stroke-width="2" ${same ? 'stroke-dasharray="4 3"' : ""} data-tip="${esc(tipTxt)}"/>
        <text x="${cx}" y="${mY + mH / 2}" font-size="9" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${cx} ${mY + mH / 2})" style="fill:${same ? "var(--bad)" : "var(--surface)"};pointer-events:none">TM${esc(nm)}</text>`;
    });
    // termini: N at the first residue, C at the last
    const badge = (bx, by, t) => `<circle cx="${bx}" cy="${by}" r="9" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><text x="${bx}" y="${by + 0.5}" font-size="10.5" font-weight="700" text-anchor="middle" dominant-baseline="middle" style="fill:var(--ink)">${t}</text>`;
    const r0 = regs[0], rN = regs[regs.length - 1];
    if (r0.side) s += badge(r0.x0 - 10, yOf(isTop(r0.side)), "N") + `<text x="${r0.x0 - 10}" y="${yOf(isTop(r0.side)) + (isTop(r0.side) ? -14 : 22)}" font-size="9.5" text-anchor="middle">1</text>`;
    if (rN.side) s += badge(rN.x1 + 10, yOf(isTop(rN.side)), "C") + `<text x="${rN.x1 + 10}" y="${yOf(isTop(rN.side)) + (isTop(rN.side) ? -14 : 22)}" font-size="9.5" text-anchor="middle">${L}</text>`;
    // UniProt annotation track (same x scale)
    s += `<text x="4" y="${upY - 8}" font-size="10.5" font-weight="600">UniProt annotation</text>`;
    regs.forEach((r) => {
      const fill = r.upSide ? (isTop(r.upSide) ? V.SIDE_COLORS.top : V.SIDE_COLORS.bottom) : "var(--surface-2)";
      s += `<rect x="${r.x0}" y="${upY}" width="${Math.max(1, r.x1 - r.x0)}" height="12" fill="${fill}" stroke="var(--surface)" stroke-width="1" data-tip="${esc(`${V.regionName(r.id)} ${r.a}–${r.b}<br>UniProt TOPO_DOM: ${r.upNote || "not annotated"}`)}"/>`;
    });
    tms.forEach((t) => (s += `<rect x="${t.x0}" y="${upY - 3}" width="${tmW}" height="18" rx="3" fill="var(--ink-2)" data-tip="TRANSMEM ${t[0]}–${t[1]}"/>`));
    host.innerHTML = svg(W, H, s);
    return { regs, tms, topCode, bottomCode };
  };

  /* ── ego network (radial) ────────────────────────────────────────────── */
  V.ego = function (host, center, partners, max = 70) {
    const list = [...partners].sort((a, b) => (b.rp - a.rp) || a.gene.localeCompare(b.gene)).slice(0, max);
    const orgOrder = App.meta.compartments;
    list.sort((a, b) => {
      const ia = a.loc[0] ? orgOrder.indexOf(a.loc[0]) : 99, ib = b.loc[0] ? orgOrder.indexOf(b.loc[0]) : 99;
      return ia - ib || b.rp - a.rp;
    });
    const W = 560, H = 560, cx = W / 2, cy = H / 2, R = 205, fs = list.length <= 24 ? 14 : 10.5;
    const maxRp = Math.max(1, ...list.map((p) => p.rp));
    let edges = "", nodes = "";
    list.forEach((p, k) => {
      const t = (k / list.length) * 2 * Math.PI - Math.PI / 2;
      const x = cx + R * Math.cos(t), y = cy + R * Math.sin(t);
      const orig = App.isOriginal(p.mask);
      const w = orig ? 0.8 + 4 * Math.sqrt(p.rp / maxRp) : 1;
      edges += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${orig ? "var(--ink-2)" : "var(--aug)"}" stroke-opacity="${orig ? 0.45 : 0.8}" stroke-width="${w}" ${orig ? "" : 'stroke-dasharray="3 3"'}/>`;
      const fill = p.loc[0] ? App.orgColor(p.loc[0]) : "var(--aug)";
      const ring = p.loc[1] ? `stroke="${App.orgColor(p.loc[1])}" stroke-width="2.5"` : `stroke="var(--surface)" stroke-width="2"`;
      const tipTxt = `<b>${esc(p.gene)}</b> ${App.srcBadges(p.mask)}<br>${p.loc.map(App.orgLabel).join(" · ") || "Unassigned"}<br>${orig ? `${p.rp} residue pair(s)` : `augmented${p.common ? " via " + esc(p.common) : ""}`}`;
      const anchor = Math.cos(t) >= 0 ? "start" : "end", lx = cx + (R + 14) * Math.cos(t), ly = cy + (R + 14) * Math.sin(t) + 4;
      const href = p.acc && App.idx.byAcc.has(p.acc) ? `#/protein/${esc(p.acc)}` : null;
      nodes += `<g ${href ? `style="cursor:pointer" onclick="location.hash='${href}'"` : ""} data-tip="${esc(tipTxt)}">
        <circle cx="${x}" cy="${y}" r="7" fill="${fill}" ${ring}/>
        <text x="${lx}" y="${ly}" font-size="${fs}" text-anchor="${anchor}">${esc(p.gene)}</text></g>`;
    });
    const cfill = center.loc[0] ? App.orgColor(center.loc[0]) : "var(--aug)";
    nodes += `<circle cx="${cx}" cy="${cy}" r="15" fill="${cfill}" stroke="var(--ink)" stroke-width="2"/>
      <text x="${cx}" y="${cy + 32}" font-size="13" font-weight="700" text-anchor="middle" style="fill:var(--ink)">${esc(center.gene)}</text>`;
    host.innerHTML = svg(W, H, edges + nodes);
    return list.length;
  };

  /* ── horizontal bar list (HTML) ──────────────────────────────────────── */
  V.bars = function (host, items, opts = {}) {
    const max = Math.max(1, ...items.map((d) => d.value));
    host.innerHTML = items.map((d) => `<div class="bar-row" data-tip="${esc(d.tip || `${d.label}: ${fmt(d.value)}`)}">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.dot ? `<span class="dot" style="background:${d.dot};margin-right:6px"></span>` : ""}${esc(d.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(100 * d.value) / max}%;background:${d.color || opts.color || "var(--accent)"}"></div></div>
      <span class="num" style="text-align:right">${fmt(d.value)}</span></div>`).join("");
  };

  /* ── single stacked bar with legend ──────────────────────────────────── */
  V.stack = function (host, segs) {
    const tot = segs.reduce((s, d) => s + d.value, 0) || 1;
    host.innerHTML = `<div class="stack">${segs.map((d) => `<div style="width:${(100 * d.value) / tot}%;background:${d.color}" data-tip="${esc(d.label)}: ${fmt(d.value)} (${App.pct(d.value, tot)})"></div>`).join("")}</div>
      <div class="legend">${segs.map((d) => `<span><span class="dot" style="background:${d.color};margin-right:5px"></span>${esc(d.label)} <span class="muted num">${fmt(d.value)}</span></span>`).join("")}</div>`;
  };
})();
