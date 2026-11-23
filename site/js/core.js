/* DUC-XL-MS Atlas — core: data access, routing, shared UI helpers. */
"use strict";
const App = (window.App = { views: {}, cache: {} });

/* ── storage (best effort) ─────────────────────────────────────────────── */
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* ── data files (site/data/, plain JSON / text) ───────────────────────── */
App.load = function (path, kind = "json") {
  const k = `${kind}:${path}`;
  if (!App.cache[k]) {
    const file = kind === "json" ? `data/${path}.json` : `data/${path}`;
    App.cache[k] = fetch(file).then((r) => {
      if (!r.ok) throw new Error(`Cannot load ${file} (${r.status})`);
      return kind === "json" ? r.json() : r.text();
    });
  }
  return App.cache[k];
};

/* ── DOM helpers ───────────────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n == null || n === "" ? "–" : typeof n === "number" ? n.toLocaleString("en-US") : n);
const pct = (a, b, d = 1) => (b ? ((100 * a) / b).toFixed(d) + "%" : "–");
Object.assign(App, { $, $$, esc, fmt, pct, store });

App.orgColor = (c) => App.meta.organelleColors[c] || "var(--muted)";
App.orgLabel = (c) => App.meta.organelleLabels[c] || c;
App.locList = (loc) => (loc ? loc.split(";").filter(Boolean) : []);
App.orgChips = (loc) => App.locList(loc).map((c) =>
  `<span class="chip"><span class="dot" style="background:${App.orgColor(c)}"></span>${esc(App.orgLabel(c))}</span>`).join("") ||
  `<span class="chip muted">Unassigned</span>`;
App.protLink = (acc, label) => acc && App.idx.byAcc.has(acc)
  ? `<a href="#/protein/${esc(acc)}">${esc(label ?? App.geneOf(acc))}</a>` : esc(label ?? acc);

App.SRC_NAMES = ["HEK293", "Jurkat", "BioPlex", "OpenCell", "EndoMap"];
// Reference-database edges are not cited interactions: they were added by our triadic-closure rule
App.SRC_LABELS = { HEK293: "HEK293", Jurkat: "Jurkat", BioPlex: "BioPlex augmented", OpenCell: "OpenCell augmented", EndoMap: "EndoMAP augmented" };
const SRC_TIPS = {
  HEK293: "Directly cross-linked in DUC-XL-MS (HEK293)", Jurkat: "Directly cross-linked in DUC-XL-MS (Jurkat)",
  BioPlex: "Added by triadic closure: reported in BioPlex 3.0 and both proteins share ≥ 1 DUC-XL-MS neighbour",
  OpenCell: "Added by triadic closure: reported in OpenCell and both proteins share ≥ 1 DUC-XL-MS neighbour",
  EndoMap: "Added by triadic closure: reported in EndoMAP and both proteins share ≥ 1 DUC-XL-MS neighbour",
};
App.srcNames = (mask) => App.SRC_NAMES.filter((_, i) => mask & (1 << i));
App.srcText = (mask) => App.srcNames(mask).map((s) => App.SRC_LABELS[s]).join("; ");
App.srcBadges = (mask) => App.srcNames(mask)
  .map((s) => `<span class="badge b-${s}" title="${esc(SRC_TIPS[s])}">${App.SRC_LABELS[s]}</span>`).join("");
App.isOriginal = (mask) => (mask & (1 | 2)) !== 0;
/* new findings (relative to UniProt / databases), bitmask from 01_build_data.py */
App.NOV = { loc: 1, topo: 2, correction: 4, slim: 8, contact: 16 };
App.newBadge = (txt = "NEW", title = "New in this study: not in UniProt or the reference databases") =>
  `<span class="nb" title="${esc(title)}">${esc(txt)}</span>`;
/* compartment chips: DUC-XL-MS assignment with new compartments highlighted, else UniProt as default */
App.locChips = (p) => {
  const nw = new Set(App.locList(p.newLoc));
  if (p.loc) return App.locList(p.loc).map((c) => nw.has(c)
    ? `<span class="chip is-new" title="DUC-XL-MS localization not annotated in UniProt"><span class="dot" style="background:${App.orgColor(c)}"></span>${esc(App.orgLabel(c))} <span class="nb">NEW</span></span>`
    : `<span class="chip" title="DUC-XL-MS localization, consistent with UniProt"><span class="dot" style="background:${App.orgColor(c)}"></span>${esc(App.orgLabel(c))}</span>`).join("");
  if (p.upLoc) return App.locList(p.upLoc).map((c) =>
    `<span class="chip up" title="UniProt annotation (no DUC-XL-MS assignment)"><span class="dot" style="background:${App.orgColor(c)}"></span>${esc(App.orgLabel(c))} · UniProt</span>`).join("");
  return `<span class="chip muted">No organelle assignment</span>`;
};

/* tooltip */
const tip = () => $("#tooltip");
App.tipShow = (html, ev) => { const t = tip(); t.innerHTML = html; t.hidden = false; App.tipMove(ev); };
App.tipMove = (ev) => {
  const t = tip(); if (t.hidden || !ev) return;
  const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
  if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
  t.style.left = x + "px"; t.style.top = y + "px";
};
App.tipHide = () => { tip().hidden = true; };
App.bindTips = (root) => {
  root.addEventListener("mousemove", (ev) => {
    const el = ev.target.closest("[data-tip]");
    if (el) App.tipShow(el.getAttribute("data-tip"), ev); else App.tipHide();
  });
  root.addEventListener("mouseleave", App.tipHide);
};

/* ── data model ────────────────────────────────────────────────────────── */
async function loadBase() {
  App.meta = await App.load("meta");
  const P = await App.load("proteins");
  const byAcc = new Map(), byGene = new Map();
  P.acc.forEach((a, i) => {
    byAcc.set(a, i);
    const g = (P.gene[i] || "").toUpperCase();
    if (!byGene.has(g)) byGene.set(g, i);
  });
  for (const [g, a] of Object.entries(App.meta.geneToAcc)) {
    const k = g.toUpperCase();
    if (!byGene.has(k) && byAcc.has(a)) byGene.set(k, byAcc.get(a));
  }
  App.P = P;
  App.idx = { byAcc, byGene };
}
App.geneOf = (acc) => { const i = App.idx.byAcc.get(acc); return i == null ? acc : App.P.gene[i] || acc; };
App.prot = (acc) => {
  const i = App.idx.byAcc.get(acc); if (i == null) return null;
  const o = {}; for (const k in App.P) o[k] = App.P[k][i]; return o;
};
App.resolve = (q) => {
  q = (q || "").trim(); if (!q) return null;
  if (App.idx.byAcc.has(q)) return q;
  const up = q.toUpperCase();
  if (App.idx.byAcc.has(up)) return up;
  const i = App.idx.byGene.get(up);
  return i == null ? null : App.P.acc[i];
};
App.search = (q, n = 12) => {
  q = q.trim().toUpperCase(); if (!q) return [];
  const P = App.P, out = [];
  for (let i = 0; i < P.acc.length && out.length < 400; i++) {
    const g = (P.gene[i] || "").toUpperCase(), a = P.acc[i];
    let s = -1;
    if (g === q || a === q) s = 0;
    else if (g.startsWith(q)) s = 1;
    else if (a.startsWith(q)) s = 2;
    else if (g.includes(q)) s = 3;
    else if (q.length > 3 && (P.name[i] || "").toUpperCase().includes(q)) s = 4;
    if (s >= 0) out.push([s, -(P.dH[i] + P.dJ[i]), i]);
  }
  out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return out.slice(0, n).map((x) => x[2]);
};
App.details = async (acc) => {
  const crc = crc32(acc) % App.meta.nShards;
  const shard = await App.load(`details/${String(crc).padStart(2, "0")}`);
  return shard[acc] || null;
};
/* network (lazy) */
App.network = async () => {
  if (App._net) return App._net;
  const [E, L] = await Promise.all([App.load("network_edges"), App.load("network_layout")]);
  const adj = E.nodes.map(() => []);
  E.edges.forEach((e, k) => { adj[e[0]].push(k); adj[e[1]].push(k); });
  const nodeOfAcc = new Map();
  E.acc.forEach((a, i) => { if (a && !nodeOfAcc.has(a)) nodeOfAcc.set(a, i); });
  // flag the largest connected component (small components are packed below it in the layout)
  const comp = new Int32Array(E.nodes.length).fill(-1), sizes = [];
  for (let s = 0; s < comp.length; s++) {
    if (comp[s] >= 0) continue;
    const id = sizes.length, stack = [s]; comp[s] = id; let n = 0;
    while (stack.length) {
      const v = stack.pop(); n++;
      for (const k of adj[v]) { const e = E.edges[k], o = e[0] === v ? e[1] : e[0]; if (comp[o] < 0) { comp[o] = id; stack.push(o); } }
    }
    sizes.push(n);
  }
  const mainId = sizes.indexOf(Math.max(...sizes));
  const inMain = Array.from(comp, (c) => c === mainId);
  App._net = { ...E, xy: L, adj, nodeOfAcc, inMain };
  return App._net;
};
App.nodeLoc = (net, i) => { const a = net.acc[i]; const p = a != null ? App.idx.byAcc.get(a) : null; return p == null ? null : App.P.loc[p]; };

/* zlib-compatible CRC32 (matches Python's zlib.crc32 used for sharding) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(s) { let c = 0xffffffff; for (const b of new TextEncoder().encode(s)) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/* ── sortable / filterable table ───────────────────────────────────────── */
/* cols: [{key, label, num, render(row)->html, text(row)->string for search}] */
App.table = function (host, rows, cols, opts = {}) {
  const st = { q: "", sort: opts.sort ?? null, dir: opts.dir ?? -1, limit: opts.limit ?? 500, filter: null };
  host.innerHTML = `
    <div class="tbl-tools">
      <input type="search" placeholder="${esc(opts.placeholder || "Filter rows…")}" aria-label="Filter table">
      ${opts.tools || ""}
    </div>
    <div class="tbl-wrap"><table><thead><tr>${cols.map((c, i) =>
      `<th data-i="${i}" class="${c.num ? "num" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody></tbody></table></div>
    <div class="tbl-foot"><span data-count></span><span>${esc(opts.foot || "")}</span></div>`;
  const tbody = $("tbody", host), q = $("input[type=search]", host);
  const val = (r, c) => (c.value ? c.value(r) : r[c.key]);
  const txt = (r, c) => (c.text ? c.text(r) : val(r, c));
  let view = rows;
  function draw() {
    const needle = st.q.toLowerCase();
    view = rows.filter((r) => (!st.filter || st.filter(r)) &&
      (!needle || cols.some((c) => String(txt(r, c) ?? "").toLowerCase().includes(needle))));
    if (st.sort != null) {
      const c = cols[st.sort];
      view = [...view].sort((a, b) => {
        const x = val(a, c), y = val(b, c);
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * st.dir;
      });
    }
    tbody.innerHTML = view.slice(0, st.limit).map((r) => `<tr>${cols.map((c) =>
      `<td class="${c.num ? "num" : ""}${c.wrap ? " wrap" : ""}">${c.render ? c.render(r) : esc(fmt(val(r, c)))}</td>`).join("")}</tr>`).join("");
    $$("th", host).forEach((th, i) => { th.classList.toggle("sorted", i === st.sort); th.dataset.dir = st.dir > 0 ? "↑" : "↓"; });
    $("[data-count]", host).textContent = view.length > st.limit
      ? `Showing ${st.limit.toLocaleString()} of ${view.length.toLocaleString()} rows — refine the filter`
      : `${view.length.toLocaleString()} rows`;
  }
  q.addEventListener("input", () => { st.q = q.value; draw(); });
  $$("th", host).forEach((th) => th.addEventListener("click", () => {
    const i = +th.dataset.i; st.dir = st.sort === i ? -st.dir : cols[i].num ? -1 : 1; st.sort = i; draw();
  }));
  draw();
  return { setFilter(f) { st.filter = f; draw(); }, redraw: draw, host };
};

/* ── search box wiring ─────────────────────────────────────────────────── */
App.wireSearch = function (input, box) {
  let sel = -1, items = [];
  const close = () => { box.hidden = true; sel = -1; };
  const go = (acc) => { close(); input.value = ""; location.hash = `#/protein/${acc}`; };
  input.addEventListener("input", () => {
    items = App.search(input.value);
    if (!items.length) { box.innerHTML = input.value ? `<div class="muted small" style="padding:8px 10px">No cross-linked protein matches</div>` : ""; box.hidden = !input.value; return; }
    box.innerHTML = items.map((i, k) => `<a href="#/protein/${esc(App.P.acc[i])}" data-k="${k}"><span><b>${esc(App.P.gene[i])}</b> <span class="mono muted">${esc(App.P.acc[i])}</span></span><span class="s-name">${esc(App.P.name[i] || "")}</span></a>`).join("");
    box.hidden = false; sel = -1;
  });
  input.addEventListener("keydown", (e) => {
    const links = $$("a", box);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
      links.forEach((l, k) => l.classList.toggle("sel", k === sel));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const acc = sel >= 0 && items[sel] != null ? App.P.acc[items[sel]] : App.resolve(input.value) || (items[0] != null && App.P.acc[items[0]]);
      if (acc) go(acc);
    } else if (e.key === "Escape") close();
  });
  box.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  document.addEventListener("click", (e) => { if (!box.contains(e.target) && e.target !== input) close(); });
};

/* ── router ────────────────────────────────────────────────────────────── */
App.routes = [
  [/^\/?$/, "home", "home"],
  [/^\/new(?:\?s=(\w+))?$/, "newFindings", "new"],
  [/^\/network(?:\/(.+))?$/, "network", "network"],
  [/^\/protein\/(.+)$/, "protein", ""],
  [/^\/organelles$/, "organelles", "spatial"],
  [/^\/topology$/, "topology", "spatial"],
  [/^\/contacts$/, "contacts", "spatial"],
  [/^\/slims$/, "slims", "structural"],
  [/^\/complexes$/, "complexes", "structural"],
  [/^\/complex\/(.+)$/, "complex", "structural"],
  [/^\/systems$/, "systems", "systems"],
  [/^\/about$/, "about", "about"],
];
async function route() {
  const path = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
  const main = $("#app");
  App.tipHide();
  if (App.onLeave) { try { App.onLeave(); } catch (e) {} App.onLeave = null; }
  $$(".nav-group").forEach((d) => d.removeAttribute("open"));
  for (const [re, view, sec] of App.routes) {
    const m = path.match(re);
    if (!m) continue;
    $$("#nav [data-sec]").forEach((el) => el.classList.toggle("active", el.dataset.sec === sec));
    main.innerHTML = `<div class="loading">Loading…</div>`;
    scrollTo(0, 0);
    try { await App.views[view](main, ...m.slice(1)); }
    catch (err) { console.error(err); main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p></div>`; }
    return;
  }
  main.innerHTML = `<div class="card"><h2>Page not found</h2><p><a href="#/">Back to home</a></p></div>`;
}

/* ── theme ─────────────────────────────────────────────────────────────── */
function initTheme() {
  // dark by default (set on <html>); a theme chosen with the toggle is remembered.
  // Key bumped to -v2 so choices saved while the site followed the system theme no longer apply.
  const t = store.lget("ducxl-theme-v2");
  document.documentElement.dataset.theme = t || "dark";
  $("#theme-btn").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next; store.lset("ducxl-theme-v2", next);
    window.dispatchEvent(new Event("themechange"));
  });
}
App.cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ── boot ──────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  try { await loadBase(); }
  catch (err) { $("#app").innerHTML = `<div class="card"><h2>Data not found</h2><p class="muted">${esc(err.message)} — run build.sh to publish data into site/data/.</p></div>`; return; }
  App.wireSearch($("#top-search"), $("#top-suggest"));
  window.addEventListener("hashchange", route);
  route();
});
