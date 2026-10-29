/* ================= voxel engine =================
   Tiny isometric voxel renderer: models are lists of [x, y, z, color]. x goes right-down, y left-down, z up.
   Faces hidden by a neighbour are skipped, so models read as clean solid blocks. */
const VOX = (() => {
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  function bounds(vox, s) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y, z] of vox) {
      const sx = (x - y) * s, sy = (x + y) * s / 2 - z * s;
      minX = Math.min(minX, sx - s); maxX = Math.max(maxX, sx + s);
      minY = Math.min(minY, sy - s); maxY = Math.max(maxY, sy + s * 1.5);
    }
    return { minX, maxX, minY, maxY };
  }
  // Draws onto ctx with origin (ox, oy) = screen position of voxel (0,0,0).
  function draw(ctx, vox, s, ox, oy, opts = {}) {
    const set = new Set(vox.map(([x, y, z]) => `${x},${y},${z}`));
    const has = (x, y, z) => set.has(`${x},${y},${z}`);
    const list = [...vox].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]) || a[2] - b[2]);
    const edge = opts.edge ?? .06;
    for (const [x, y, z, c] of list) {
      const cx = ox + (x - y) * s, cy = oy + (x + y) * s / 2 - z * s;
      const top = [[cx, cy - s / 2], [cx + s, cy], [cx, cy + s / 2], [cx - s, cy]];
      const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.strokeStyle = `rgba(0,0,0,${edge})`; ctx.lineWidth = Math.max(.5, s * .04); ctx.stroke(); } };
      if (!has(x, y + 1, z)) poly([[cx - s, cy], [cx, cy + s / 2], [cx, cy + s * 1.5], [cx - s, cy + s]], shade(c, .62));
      if (!has(x + 1, y, z)) poly([[cx + s, cy], [cx, cy + s / 2], [cx, cy + s * 1.5], [cx + s, cy + s]], shade(c, .8));
      if (!has(x, y, z + 1)) poly(top, shade(c, 1.06));
    }
  }
  // Render a model into a fresh canvas sized to fit; returns the canvas.
  function canvas(vox, s, pad = 4, dpr = Math.min(3, window.devicePixelRatio || 1)) {
    const b = bounds(vox, s), w = b.maxX - b.minX + pad * 2, h = b.maxY - b.minY + pad * 2;
    const c = document.createElement("canvas"); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    c.style.width = w + "px"; c.style.height = h + "px";
    const g = c.getContext("2d"); g.scale(dpr, dpr); g.lineJoin = "round";
    draw(g, vox, s, -b.minX + pad, -b.minY + pad);
    return c;
  }
  const url = (vox, s, pad) => canvas(vox, s, pad).toDataURL("image/png");
  // Several models drawn with one shared origin, so stacked layers line up exactly.
  function layers(models, s, pad = 6, dpr = Math.min(3, window.devicePixelRatio || 1)) {
    const b = bounds(models.flat(), s), w = b.maxX - b.minX + pad * 2, h = b.maxY - b.minY + pad * 2;
    return models.map(m => {
      const c = document.createElement("canvas"); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext("2d"); g.scale(dpr, dpr); g.lineJoin = "round";
      draw(g, m, s, -b.minX + pad, -b.minY + pad);
      return { url: c.toDataURL("image/png"), w, h };
    });
  }
  const cache = new Map();
  const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  /* ---------- models ---------- */
  const rnd = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function pin(color = "#FFD43B", hole = "#12151C") {
    const v = [];
    // rounded head 5x5x5 sphere-ish, tapering spike below
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 5; z++) {
      const d = Math.hypot(x - 2, y - 2, z - 2); if (d <= 2.45) v.push([x, y, z + 3, (z >= 2 && z <= 2 && x === 4 && y === 2) ? hole : color]);
    }
    v.push([2, 2, 2, color], [2, 2, 1, color], [2, 2, 0, shadeHex(color, .8)]);
    return v;
  }
  function shadeHex(hex, k) { const m = shade(hex, k).match(/\d+/g).map(Number); return "#" + m.map(n => n.toString(16).padStart(2, "0")).join(""); }
  function crystal(color) {
    const v = [];
    for (let z = 0; z < 7; z++) { const r = z < 3 ? z : 6 - z; for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) if (Math.abs(x) + Math.abs(y) <= r) v.push([x + 3, y + 3, z, (x + y + z) % 3 === 0 ? shadeHex(color, 1.25) : color]); }
    return v;
  }
  function crate(Y = "#FFD43B", D = "#1E2230") {
    const v = [];
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) for (let z = 0; z < 6; z++) {
      const edgeCount = (x === 0 || x === 5) + (y === 0 || y === 5) + (z === 0 || z === 5);
      if (edgeCount === 0) continue;
      v.push([x, y, z, edgeCount >= 2 ? Y : D]);
    }
    return v;
  }
  // Yalta diorama split into parallax layers.
  function diorama(seed = 7) {
    const R = rnd(seed), back = [], mid = [], front = [], N = 16;
    const SEA = ["#2B7BD8", "#3A8CE6", "#2468BF"], SAND = "#E9C97A", GRASS = ["#5DBB63", "#4FA857", "#6CC872"], ROCK = ["#8E96A8", "#7A8296", "#A2A9B8"];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      // coastline: land on the back half (small y), sea on the front
      const coast = 6 + Math.round(Math.sin(x * .7) * 1.4 + Math.cos(x * .31) * 1.2);
      if (y > coast) { mid.push([x, y, 0, SEA[(x * 3 + y * 7) % 3]]); continue; }
      const land = y >= coast - 1 ? 1 : 2;
      for (let z = 0; z < land; z++) mid.push([x, y, z, y >= coast - 1 ? SAND : GRASS[(x + y + z) % 3]]);
      // mountains along the back
      const hgt = Math.max(0, Math.round((coast - 2 - y) * 1.6 + Math.sin(x * .9 + seed) * 1.5 + R() * 1.2));
      for (let z = land; z < land + hgt; z++) back.push([x, y, z, z > land + hgt - 2 && hgt > 4 ? "#F2F4F8" : ROCK[(x + z) % 3]]);
    }
    // cypress trees on the slope
    [[2, 4], [4, 3], [11, 4], [13, 3], [8, 2]].forEach(([x, y]) => { const h = 3 + (R() * 2 | 0); for (let z = 2; z < 2 + h; z++) mid.push([x, y, z, z === 2 ? "#6B4A2B" : "#2F7D44"]); mid.push([x, y, 2 + h, "#3C9655"]); });
    // lighthouse on the pier
    for (let z = 1; z < 8; z++) mid.push([12, 9, z, z % 2 ? "#FFFFFF" : "#FF5C6C"]);
    mid.push([12, 9, 8, "#FFD43B"], [12, 9, 9, "#FF5C6C"]);
    for (let y = 7; y < 10; y++) mid.push([12, y, 0, "#B9C0D0"]);
    // little boat
    [[5, 11], [6, 11], [7, 11]].forEach(([x, y]) => front.push([x, y, 1, "#FFFFFF"]));
    front.push([6, 11, 2, "#FF8A3D"], [6, 11, 3, "#FFFFFF"]);
    // ginger cat on the sand
    front.push([8, 6, 2, "#FF9F43"], [9, 6, 2, "#FF9F43"], [9, 6, 3, "#FFB86B"], [7, 6, 3, "#FF9F43"]);
    // floating pin above the town
    pin().forEach(([x, y, z, c]) => front.push([x + 5, y + 1, z + 9, c]));
    return { back, mid, front };
  }
  return { draw, canvas, url, layers, cached, pin, crystal, crate, diorama, shadeHex };
})();

/* ================= parallax ================= */
const PX = (() => {
  let tiltX = 0, tiltY = 0, raf = 0;
  const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); };
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function apply() {
    if (still) return;
    const sc = document.querySelector(".scroll");
    const st = sc ? sc.scrollTop : 0, vh = innerHeight;
    // layered dioramas: [data-depth] moves with scroll and tilt
    document.querySelectorAll("[data-depth]").forEach(el => {
      const d = +el.dataset.depth;
      el.style.transform = `translate3d(${(tiltX * d * 18).toFixed(1)}px, ${(st * d * .45 + tiltY * d * 12).toFixed(1)}px, 0)`;
    });
    // photos drift inside their frames
    document.querySelectorAll(".px-in").forEach(el => {
      const r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      const k = ((r.top + r.height / 2) / vh - .5);
      el.style.transform = `translate3d(${(tiltX * 6).toFixed(1)}px, ${(k * -18 + tiltY * 5).toFixed(1)}px, 0) scale(1.14)`;
    });
  }
  document.addEventListener("scroll", run, { capture: true, passive: true });
  window.addEventListener("resize", run);
  // device tilt (Telegram 8.0 API first, then the browser one), pointer on desktop
  const onTilt = (b, g) => { tiltX = Math.max(-1, Math.min(1, g / 30)); tiltY = Math.max(-1, Math.min(1, (b - 45) / 30)); run(); };
  function startTilt() {
    const DO = window.Telegram?.WebApp?.DeviceOrientation;
    if (DO && window.Telegram.WebApp.isVersionAtLeast?.("8.0")) {
      try { DO.start({ refresh_rate: 60 }, ok => { if (!ok) browserTilt(); }); window.Telegram.WebApp.onEvent("deviceOrientationChanged", () => onTilt((DO.beta || 0) * 57.3, (DO.gamma || 0) * 57.3)); return; } catch {}
    }
    browserTilt();
  }
  function browserTilt() { window.addEventListener("deviceorientation", e => { if (e.beta != null) onTilt(e.beta, e.gamma || 0); }, { passive: true }); }
  window.addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; tiltX = (e.clientX / innerWidth - .5) * 2; tiltY = (e.clientY / innerHeight - .5) * 2; run(); }, { passive: true });
  if (!still) startTilt();
  return { refresh: run };
})();
