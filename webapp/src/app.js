/* ================= config ================= */
const CFG = {
  api: "@@API_URL@@",          // Cloudflare Worker address, e.g. https://metka-api.yourname.workers.dev
  bot: "@@BOT_USERNAME@@",     // bot username without @
  app: "@@APP_NAME@@",         // Mini App short name from BotFather
};
const TG = window.Telegram?.WebApp;
const INIT = TG?.initData || "";
const DEMO = !INIT || !/^https:\/\//.test(CFG.api);

/* ================= telegram shell ================= */
try {
  TG?.ready(); TG?.expand();
  TG?.disableVerticalSwipes?.();
  const root = document.documentElement;
  if (INIT) { if (TG.colorScheme === "light") root.dataset.theme = "light"; }
  else if (!root.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  TG?.setHeaderColor?.(bg); TG?.setBackgroundColor?.(bg); TG?.setBottomBarColor?.(bg);
  TG?.onEvent?.("themeChanged", () => { document.documentElement.dataset.theme = TG.colorScheme === "light" ? "light" : ""; });
} catch {}

const H = {
  tap() { try { TG?.HapticFeedback ? TG.HapticFeedback.impactOccurred("light") : navigator.vibrate?.(8); } catch {} },
  pick() { try { TG?.HapticFeedback ? TG.HapticFeedback.selectionChanged() : navigator.vibrate?.(5); } catch {} },
  heavy() { try { TG?.HapticFeedback ? TG.HapticFeedback.impactOccurred("heavy") : navigator.vibrate?.(25); } catch {} },
  ok() { try { TG?.HapticFeedback ? TG.HapticFeedback.notificationOccurred("success") : navigator.vibrate?.([14, 50, 22]); } catch {} },
  err() { try { TG?.HapticFeedback ? TG.HapticFeedback.notificationOccurred("error") : navigator.vibrate?.([40, 60, 40]); } catch {} },
  async seq(n) { for (let i = 0; i < n; i++) { this.heavy(); await new Promise(r => setTimeout(r, 110)); } this.ok(); },
};
let actx;
function chime(level = 1) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, .09], [1320, .18], [1760, .3]].slice(0, 2 + level).forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = "triangle"; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const s = actx.currentTime + t; g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.16, s + .02); g.gain.exponentialRampToValueAtTime(.0001, s + .45); o.start(s); o.stop(s + .5);
    });
  } catch {}
}

/* ================= utils ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const COLOR = Object.fromEntries(COLORS.map(c => [c.id, c]));
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function genStyle(code) { const h = hashStr(code), a = h % 360, b = (a + 40 + (h >> 9) % 80) % 360; return `--g1:hsl(${a} 72% 60%);--g2:hsl(${b} 66% 46%);--g3:hsl(${(a + 200) % 360} 32% 18%)`; }
/* ---------- card patterns: motif + emoji + colour, assigned by the system ---------- */
const patOf = m => m.pattern || makePattern(m.rarity, m.emoji, null, seeded(m.code));
const PATCACHE = new Map();
function patternURL(p, key) {
  const id = key + p.m + p.c1 + p.e;
  if (PATCACHE.has(id)) return PATCACHE.get(id);
  const W = 400, H = 500, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), R = seeded(key), sh = (h, k) => VOX.shadeHex(h, k);
  const emo = (x, y, size, rot = 0, a = 1) => { g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot); g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p.e, 0, 0); g.restore(); };
  if (p.m === "waves") {
    g.fillStyle = sh(p.c1, .42); g.fillRect(0, 0, W, H);
    for (let i = -1; i < 9; i++) {
      const y0 = i * 62, amp = 16 + R() * 10, ph = R() * 6;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 + Math.sin(x / 48 + ph) * amp);
      g.lineTo(W, H); g.closePath();
      g.fillStyle = i % 2 ? sh(p.c1, .7 + i * .03) : sh(p.c2, .55 + i * .04); g.fill();
      for (let x = 30 + (i % 2) * 30; x < W; x += 74) emo(x, y0 + Math.sin(x / 48 + ph) * amp + 30, 24, Math.sin(x) * .25, .9);
    }
  } else if (p.m === "stars") {
    const gr = g.createRadialGradient(W * .5, H * .3, 10, W * .5, H * .4, H * .75); gr.addColorStop(0, sh(p.c2, .45)); gr.addColorStop(1, "#070814");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 170; i++) { g.fillStyle = `rgba(255,255,255,${.25 + R() * .7})`; const r = R() * 1.6 + .3; g.beginPath(); g.arc(R() * W, R() * H, r, 0, 7); g.fill(); }
    const nodes = Array.from({ length: 7 }, () => [40 + R() * (W - 80), 40 + R() * (H - 80)]).sort((a, b) => a[0] - b[0]);
    g.strokeStyle = p.c2; g.globalAlpha = .55; g.lineWidth = 1.6; g.beginPath(); nodes.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.globalAlpha = 1;
    g.shadowColor = p.c2; g.shadowBlur = 22; nodes.forEach(([x, y], i) => emo(x, y, i % 3 ? 22 : 32)); g.shadowBlur = 0;
  } else {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, p.c1); gr.addColorStop(1, sh(p.c1, .5));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) { g.fillStyle = [p.c2, "#FFFFFF", sh(p.c1, 1.35)][i % 3]; g.save(); g.translate(R() * W, R() * H); g.rotate(R() * 6); g.globalAlpha = .7; g.fillRect(-6, -3, 12, 6); g.restore(); }
    for (let i = 0; i < 30; i++) emo(R() * W, R() * H, 18 + R() * 28, (R() - .5) * 1.2, .55 + R() * .45);
  }
  if (p.holo) { const hg = g.createLinearGradient(0, 0, W, H); ["#ff0080", "#ffd000", "#00ffaa", "#0090ff", "#c000ff"].forEach((col, i) => hg.addColorStop(i / 4, col)); g.globalCompositeOperation = "overlay"; g.globalAlpha = .35; g.fillStyle = hg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; }
  const url = c.toDataURL("image/jpeg", .86); PATCACHE.set(id, url); return url;
}
const art = m => `<div class="px-in pat" style="background-image:url(${patternURL(patOf(m), m.code)})"></div>` +
  (m.photo ? `<div class="photo-in"><img class="pimg px-in" src="${esc(m.photo)}" alt="" loading="lazy" data-fb="1"></div>` : `<span class="pat-e">${esc(m.emoji)}</span>`);
const RCOL = { common: "#9AA4B8", rare: "#4D8BFF", epic: "#A66BFF", legend: "#FFB020" };
const VA = {
  pin: (c = "#FFD43B") => VOX.cached("pin" + c, () => VOX.url(VOX.pin(c), 3, 2)),
  crystal: c => VOX.cached("cr" + c, () => VOX.url(VOX.crystal(c), 5, 4)),
  crate: () => VOX.cached("crate", () => VOX.url(VOX.crate(), 9, 4)),
  diorama: () => VOX.cached("dio", () => VOX.layers(Object.values(VOX.diorama()), 9)),
};
const vpin = (cls = "vpin") => `<img class="${cls}" src="${VA.pin()}" alt="">`;
function dioramaHTML(inner, cls = "") {
  const L = VA.diorama();
  return `<section class="dio ${cls}"><div class="dio-stage">${L.map((l, i) => `<img class="dio-l" data-depth="${[.1, .2, .36][i]}" src="${l.url}" style="aspect-ratio:${l.w}/${l.h}" alt="">`).join("")}</div><div class="dio-t">${inner}</div></section>`;
}
const crateImg = () => `<img class="crate" src="${VA.crate()}" alt="">`;
document.addEventListener("error", e => { const t = e.target; if (t?.tagName === "IMG" && t.dataset.fb) t.remove(); }, true);
const cvars = id => { const c = COLOR[id] || COLORS[0]; return `--ca:${c.a};--cb:${c.b}`; };
const avatar = (u, sz = 40, st = true) => `<span class="av" style="--sz:${sz}px;${cvars(u?.color)}">${esc(u?.avatar || "🦊")}${st && u?.status ? `<span class="st">${esc(u.status)}</span>` : ""}</span>`;
const fmtDist = m => m == null ? "" : m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} км`;
const fmtDate = ms => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const ago = ms => { const s = (Date.now() - ms) / 1000; if (s < 60) return "только что"; if (s < 3600) return `${Math.floor(s / 60)} мин назад`; if (s < 86400) return `${Math.floor(s / 3600)} ч назад`; return `${Math.floor(s / 86400)} дн назад`; };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const hasGeo = m => Number.isFinite(m?.lat) && Number.isFinite(m?.lon);
const appLink = code => `https://t.me/${CFG.bot.startsWith("@@") ? "Metkadetect_bot" : CFG.bot}/${CFG.app.startsWith("@@") ? "app" : CFG.app}?startapp=m_${code}`;
function toast(msg, ms = 2600) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function openLink(url) { try { TG?.openLink ? TG.openLink(url) : window.open(url, "_blank", "noopener"); } catch { window.open(url, "_blank"); } }
function openTgLink(url) { try { TG?.openTelegramLink ? TG.openTelegramLink(url) : window.open(url, "_blank", "noopener"); } catch { window.open(url, "_blank"); } }
document.addEventListener("pointerdown", e => { if (e.target.closest("button,.pick,a.btn")) H.tap(); }, { passive: true });

/* ================= location ================= */
const GEO = { pos: null, watchers: new Set() };
function getLocation() {
  return new Promise(resolve => {
    const done = p => { if (!p && DEMO) p = { lat: 44.49536, lon: 34.17104, acc: 15, demo: true }; if (p) { GEO.pos = p; GEO.watchers.forEach(f => f(p)); } resolve(p); };
    const viaBrowser = () => {
      if (!navigator.geolocation) return done(null);
      navigator.geolocation.getCurrentPosition(
        p => done({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
        () => done(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 });
    };
    const LM = TG?.LocationManager;
    if (LM && TG.isVersionAtLeast?.("8.0")) {
      const ask = () => LM.getLocation(d => d ? done({ lat: d.latitude, lon: d.longitude, acc: d.horizontal_accuracy }) : viaBrowser());
      LM.isInited ? ask() : LM.init(() => (LM.isLocationAvailable ? ask() : viaBrowser()));
    } else viaBrowser();
  });
}

/* ================= EXIF + images ================= */
function readGps(buf) {
  try {
    const v = new DataView(buf); if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o < v.byteLength - 4) {
      const mk = v.getUint16(o), len = v.getUint16(o + 2);
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le);
        const ifd = u32(4), n = u16(ifd); let gps = 0;
        for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === 0x8825) gps = u32(e + 8); }
        if (!gps) return null;
        const g = {}, gn = u16(gps);
        for (let i = 0; i < gn; i++) {
          const e = gps + 2 + i * 12, tag = u16(e);
          if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(t + e + 8));
          if (tag === 2 || tag === 4) { const p = u32(e + 8), r = k => u32(p + k * 8) / (u32(p + k * 8 + 4) || 1); g[tag] = r(0) + r(1) / 60 + r(2) / 3600; }
        }
        if (g[2] == null || g[4] == null) return null;
        const lat = g[2] * (g[1] === "S" ? -1 : 1), lon = g[4] * (g[3] === "W" ? -1 : 1);
        return (lat || lon) ? { lat, lon } : null;
      }
      if ((mk & 0xFF00) !== 0xFF00) break;
      o += 2 + len;
    }
  } catch {}
  return null;
}
function parseCoords(s) {
  s = String(s || "").trim(); if (!s) return null;
  const y = s.match(/(?:ll|pt|whatshere%5Bpoint%5D|whatshere\[point\])=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);
  if (y) return { lat: +y[2], lon: +y[1] };
  const g = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (g) return { lat: +g[1], lon: +g[2] };
  const n = s.match(/-?\d+\.\d+/g); if (!n || n.length < 2) return null;
  let lat = +n[0], lon = +n[1]; if (Math.abs(lat) > 90) [lat, lon] = [lon, lat];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
async function compress(file) {
  let src = await createImageBitmap(file).catch(() => null);
  if (!src) { const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); src = img; }
  const k = Math.min(1, 1280 / Math.max(src.width, src.height));
  const c = document.createElement("canvas"); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const ctx = c.getContext("2d"); ctx.drawImage(src, 0, 0, c.width, c.height);
  // dominant vivid colour of the photo → card pattern colour
  const t = document.createElement("canvas"); t.width = t.height = 24; const tg = t.getContext("2d"); tg.drawImage(c, 0, 0, 24, 24);
  const px = tg.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, w = 0;
  for (let i = 0; i < px.length; i += 4) { const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]), sat = mx ? (mx - mn) / mx : 0, k = sat * sat * (mx / 255) + .02; r += px[i] * k; gg += px[i + 1] * k; b += px[i + 2] * k; w += k; }
  const tone = "#" + [r, gg, b].map(v => Math.round(v / w).toString(16).padStart(2, "0")).join("");
  const blob = await new Promise(res => c.toBlob(res, "image/jpeg", .84));
  return { blob, tone };
}

/* ================= API ================= */
async function api(path, opts = {}) {
  if (DEMO) return MOCK.handle(path, opts);
  const headers = { "x-init-data": INIT };
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers["content-type"] = "application/json"; body = JSON.stringify(body); }
  const r = await fetch(CFG.api + path, { method: opts.method || "GET", headers, body });
  const data = await r.json().catch(() => ({ error: "bad_response" }));
  if (!r.ok) throw Object.assign(new Error(data.error || "error"), data);
  return data;
}

/* ---------- demo backend (preview outside Telegram) ---------- */
const MOCK = (() => {
  const KEY = "metka-demo-v2";
  const now = Date.now(), H1 = 3600e3;
  const people = [
    { id: 2, nick: "Лиса Ялты", avatar: "🦊", color: "sun", status: "🐾", xp: 1460, streak: 6, best_streak: 9, bio: "Коллекционирую котов набережной" },
    { id: 3, nick: "Чайка", avatar: "🦉", color: "sea", status: "🪶", xp: 980, streak: 2, best_streak: 4, bio: "Птицы, море, рассветы" },
    { id: 4, nick: "Марат", avatar: "🐙", color: "grape", status: "🎨", xp: 720, streak: 1, best_streak: 3, bio: "Ищу муралы и странные двери" },
    { id: 5, nick: "Ксюша", avatar: "🦋", color: "rose", status: "🌱", xp: 310, streak: 3, best_streak: 3, bio: "" },
    { id: 6, nick: "Дед Платон", avatar: "🐢", color: "pine", status: "🌳", xp: 540, streak: 0, best_streak: 5, bio: "Деревья старше меня" },
  ];
  const seed = [
    ["BRSK7", 2, "Граф Барсик", "😼", "cat", "epic", 44.49535, 34.17105, "Набережная, у фонтана", "Спит на тёплой плитке и принимает поклонников только по утрам"],
    ["CHG42", 3, "Чайка Гоша", "🕊️", "bird", "rare", 44.4946, 34.1735, "Мол у морвокзала", "Ворует чебуреки, но с достоинством"],
    ["PLTN9", 6, "Старый Платон", "🌳", "tree", "legend", 44.4934, 34.1749, "Приморский парк", "Платан, которому больше двухсот лет"],
    ["EYE33", 4, "Глаз на стене", "👁️", "art", "common", 44.4972, 34.1648, "Пушкинская", "Смотрит на тебя, куда бы ты ни шёл"],
    ["DOOR8", 4, "Дверь в никуда", "🚪", "place", "rare", 44.4961, 34.1622, "Старый город", "Синяя дверь на втором этаже. Лестницы нет"],
    ["MRSK1", 2, "Мурзик-рыбак", "🐈", "cat", "common", 44.4957, 34.1690, "Набережная, у рыбаков", "Ждёт улов вместе со всеми"],
    ["UFO77", 5, "Тарелка на крыше", "🛸", "odd", "common", 44.4985, 34.1660, "Над кафе", "Старая спутниковая тарелка, вся в наклейках"],
    ["SUNST", 3, "Лучший закат", "🌅", "place", "epic", 44.4925, 34.1590, "Смотровая у часовни", "Отсюда видно весь залив"],
    ["KTCH2", 5, "Котёнок Пиксель", "😻", "cat", "rare", 44.4968, 34.1705, "Двор на Морской", ""],
    ["MOSA1", 4, "Мозаика-кит", "🎭", "art", "common", 44.4949, 34.1675, "Подземный переход", "Кит из битой плитки"],
  ];
  function fresh() {
    return {
      me: { id: 1, nick: "", avatar: "🦄", color: "grape", status: "🌱", bio: "", xp: 0, streak: 0, best_streak: 0, last_day: null },
      users: Object.fromEntries(people.map(p => [p.id, p])),
      marks: seed.map((s, i) => ({ code: s[0], owner: s[1], name: s[2], emoji: s[3], cat: s[4], rarity: s[5], lat: s[6], lon: s[7], place: s[8], story: s[9], num: i + 1, at: now - (i * 5 + 2) * H1, photo: null })),
      reactions: { BRSK7: { 2: "❤️", 3: "🔥", 4: "😹", 5: "❤️" }, PLTN9: { 2: "👑", 3: "🤯", 5: "👑" }, SUNST: { 2: "❤️", 6: "🔥" }, CHG42: { 2: "😹" } },
      collects: { BRSK7: { 3: now - 20 * H1, 5: now - 9 * H1 }, PLTN9: { 2: now - 30 * H1 }, CHG42: { 2: now - 6 * H1 } },
      xplog: [], claims: {},
    };
  }
  let D;
  try { D = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (!D) D = fresh();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch {} };
  const user = id => id === 1 ? D.me : D.users[id];
  const pub = u => ({ id: u.id, nick: u.nick || "Ты", avatar: u.avatar, color: u.color, status: u.status, bio: u.bio || "", xp: u.xp, level: level(u.xp), streak: u.streak, onboarded: !!u.nick });
  const shape = m => {
    const o = user(m.owner);
    return { ...m, reacts: Object.keys(D.reactions[m.code] || {}).length, collects: Object.keys(D.collects[m.code] || {}).length,
      owner: { id: o.id, nick: o.nick || "Ты", avatar: o.avatar, color: o.color, status: o.status, level: level(o.xp) } };
  };
  const addXp = (id, n, reason) => { user(id).xp += n; D.xplog.push({ id, n, at: Date.now(), reason }); };
  const touch = () => { const t = dayKey(), y = dayKey(Date.now() - 86400e3); if (D.me.last_day === t) return; D.me.streak = D.me.last_day === y ? D.me.streak + 1 : 1; D.me.best_streak = Math.max(D.me.best_streak, D.me.streak); D.me.last_day = t; };
  function stats(id) {
    const own = D.marks.filter(m => m.owner === id), cats = {}, rar = {};
    own.forEach(m => { cats[m.cat] = (cats[m.cat] || 0) + 1; rar[m.rarity] = (rar[m.rarity] || 0) + 1; });
    const collected = Object.values(D.collects).filter(c => c[id]).length;
    const likes = own.reduce((a, m) => a + Object.keys(D.reactions[m.code] || {}).filter(u => +u !== id).length, 0);
    const u = user(id);
    return { created: own.length, collected, likes, cats, rar, xp: u.xp, streak: u.streak, best_streak: u.best_streak, level: level(u.xp), top: rankOf(id) };
  }
  function weekly() {
    const since = Date.now() - 7 * 86400e3, s = {};
    Object.values(D.users).forEach(u => { s[u.id] = Math.round(u.xp * .35); });
    D.xplog.filter(x => x.at > since).forEach(x => { s[x.id] = (s[x.id] || 0) + x.n; });
    return Object.entries(s).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }
  const rankOf = id => { const i = weekly().findIndex(([k]) => +k === id); return i < 0 ? 0 : i + 1; };
  function quest() {
    const q = questOf(dayKey()), start = Date.parse(q.day + "T00:00:00+03:00");
    const progress = q.kind === "create" ? D.marks.filter(m => m.owner === 1 && m.cat === q.cat && m.at >= start).length
      : Object.values(D.collects).filter(c => c[1] && c[1] >= start).length;
    return { ...q, progress: Math.min(progress, q.n), done: !!D.claims[q.day] };
  }
  const claim = () => { const q = quest(); if (!q.done && q.progress >= q.n) { D.claims[q.day] = 1; addXp(1, q.xp, "quest"); return q.xp; } return 0; };
  const err = (e, extra = {}) => { throw Object.assign(new Error(e), { error: e, ...extra }); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function handle(path, { method = "GET", body } = {}) {
    await wait(120 + Math.random() * 160);
    const u = new URL(path, "https://x"), p = u.pathname, q = u.searchParams;
    if (p === "/api/me" && method === "GET") { const s = stats(1); return { user: pub(D.me), stats: s, statuses: unlockedStatuses(s), quest: quest() }; }
    if (p === "/api/me" && method === "POST") {
      const s = stats(1);
      D.me.nick = String(body.nick || "").trim().slice(0, 24) || D.me.nick || "Исследователь";
      if (AVATARS.includes(body.avatar)) D.me.avatar = body.avatar;
      if (COLOR[body.color]) D.me.color = body.color;
      if (unlockedStatuses(s).includes(body.status)) D.me.status = body.status;
      D.me.bio = String(body.bio || "").slice(0, 120); save(); return { user: pub(D.me) };
    }
    if (p === "/api/feed") {
      let list = D.marks.filter(m => !q.get("cat") || m.cat === q.get("cat")).map(shape);
      const lat = +q.get("lat"), lon = +q.get("lon");
      if (q.get("sort") === "near" && q.get("lat")) list = list.filter(hasGeo).map(m => ({ ...m, dist: Math.round(distM({ lat, lon }, m)) })).sort((a, b) => a.dist - b.dist);
      else if (q.get("sort") === "top") list.sort((a, b) => b.reacts - a.reacts || b.at - a.at);
      else list.sort((a, b) => b.at - a.at);
      return { marks: list };
    }
    if (p === "/api/map") return { marks: D.marks.filter(hasGeo).map(shape) };
    if (p === "/api/marks" && method === "POST") {
      const f = body, today = Date.parse(dayKey() + "T00:00:00+03:00");
      const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let code = ""; for (let i = 0; i < 5; i++) code += ABC[Math.random() * ABC.length | 0];
      const photoBlob = f.get("photo"); let photo = null;
      if (photoBlob && photoBlob.size) photo = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(photoBlob); });
      const lat = f.get("lat") ? +f.get("lat") : null, lon = f.get("lon") ? +f.get("lon") : null;
      const m = { code, owner: 1, name: f.get("name"), emoji: f.get("emoji"), cat: f.get("cat"), story: f.get("story") || "", place: f.get("place") || "",
        lat, lon, rarity: rollRarity(Math.random(), .2), num: Math.max(...D.marks.map(x => x.num)) + 1, at: Date.now(), photo };
      m.pattern = makePattern(m.rarity, m.emoji, f.get("tone"));
      D.marks.unshift(m);
      const xp = RARITY[m.rarity].xp + (photo ? 5 : 0) + (lat !== null ? 5 : 0);
      addXp(1, xp, "create"); touch(); const questXp = claim();
      try { save(); } catch { m.photo = null; save(); }
      void today; return { mark: shape(m), xp, questXp };
    }
    const mm = p.match(/^\/api\/marks\/([A-Z0-9]+)(?:\/(collect|react))?$/);
    if (mm) {
      const m = D.marks.find(x => x.code === mm[1]); if (!m) err("not_found");
      if (!mm[2] && method === "GET") {
        const rx = {}; Object.values(D.reactions[m.code] || {}).forEach(e => { rx[e] = (rx[e] || 0) + 1; });
        const col = D.collects[m.code] || {};
        return { mark: shape(m), reactions: rx, myReaction: (D.reactions[m.code] || {})[1] || null, collected: !!col[1], mine: m.owner === 1,
          collectors: Object.keys(col).sort((a, b) => col[b] - col[a]).slice(0, 8).map(id => { const x = user(+id); return { id: x.id, nick: x.nick || "Ты", avatar: x.avatar, color: x.color }; }) };
      }
      if (!mm[2] && method === "DELETE") { if (m.owner !== 1) err("forbidden"); D.marks = D.marks.filter(x => x !== m); save(); return { ok: true }; }
      if (mm[2] === "react") {
        D.reactions[m.code] = D.reactions[m.code] || {};
        const cur = D.reactions[m.code][1];
        if (cur === body.emoji) delete D.reactions[m.code][1]; else D.reactions[m.code][1] = body.emoji;
        save(); const rx = {}; Object.values(D.reactions[m.code]).forEach(e => { rx[e] = (rx[e] || 0) + 1; });
        return { reactions: rx, myReaction: D.reactions[m.code][1] || null };
      }
      if (mm[2] === "collect") {
        if (m.owner === 1) err("own_mark");
        if (hasGeo(m)) {
          if (!Number.isFinite(body.lat)) err("need_location");
          const d = distM(body, m);
          if (d > COLLECT_RADIUS_M && !body.demoNear) err("too_far", { dist: Math.round(d) });
        }
        D.collects[m.code] = D.collects[m.code] || {};
        if (D.collects[m.code][1]) err("already");
        D.collects[m.code][1] = Date.now();
        const xp = RARITY[m.rarity].collectXp; addXp(1, xp, "collect"); touch(); const questXp = claim(); save();
        return { ok: true, xp, questXp };
      }
    }
    const um = p.match(/^\/api\/users\/(\d+)$/);
    if (um) {
      const id = +um[1], x = user(id); if (!x) err("not_found");
      return { user: pub(x), stats: stats(id), marks: D.marks.filter(m => m.owner === id).sort((a, b) => b.at - a.at).map(shape),
        collected: D.marks.filter(m => (D.collects[m.code] || {})[id]).map(shape) };
    }
    if (p === "/api/top") {
      const rows = q.get("period") === "all"
        ? [D.me, ...Object.values(D.users)].filter(x => x.xp > 0).sort((a, b) => b.xp - a.xp).map(x => [x.id, x.xp])
        : weekly();
      return { rows: rows.map(([id, score], i) => ({ ...pub(user(+id)), score, rank: i + 1 })), me: rankOf(1) };
    }
    err("not_found");
  }
  return { handle, reset() { D = fresh(); save(); } };
})();

/* ================= state & navigation ================= */
const S = { me: null, stats: null, statuses: [], quest: null, tab: "feed", feedSort: "new", feedCat: "", topPeriod: "week", stack: [] };
const view = $("#view");

function pushLayer(el, onClose) {
  document.body.appendChild(el);
  S.stack.push({ el, onClose });
  TG?.BackButton?.show();
  return () => popLayer(el);
}
function popLayer(el) {
  const i = el ? S.stack.findIndex(x => x.el === el) : S.stack.length - 1;
  if (i < 0) return;
  const [it] = S.stack.splice(i, 1);
  it.el.remove(); it.onClose?.();
  if (!S.stack.length) TG?.BackButton?.hide();
}
TG?.BackButton?.onClick(() => popLayer());
document.addEventListener("keydown", e => { if (e.key === "Escape") popLayer(); });

function setTab(tab) {
  if (S.tab === tab && tab !== "map") { $(".scroll")?.scrollTo({ top: 0, behavior: "smooth" }); }
  S.tab = tab;
  $$(".tab").forEach(b => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  renderTab();
}
$$(".tab").forEach(b => b.addEventListener("click", () => { H.pick(); setTab(b.dataset.tab); }));
$("#fab").addEventListener("click", () => { H.heavy(); openCreate(); });

async function refreshMe() {
  const r = await api("/api/me");
  const oldLevel = S.me?.level, oldStatuses = new Set(S.statuses);
  Object.assign(S, { me: r.user, stats: r.stats, statuses: r.statuses, quest: r.quest });
  const fresh = S.statuses.filter(e => oldStatuses.size && !oldStatuses.has(e));
  return { levelUp: oldLevel && r.user.level > oldLevel ? r.user.level : 0, newStatuses: fresh };
}

function renderTab() {
  mapEngine?.destroy(); mapEngine = null;
  const t = S.tab;
  if (t === "feed") return renderFeed();
  if (t === "map") return renderMap();
  if (t === "top") return renderTop();
  if (t === "profile") return renderProfile(S.me.id, true);
}

function topBar() {
  const u = S.me, lv = u.level, f = levelFloor(lv), c = levelCeil(lv), pct = Math.round((u.xp - f) / (c - f) * 100);
  return `<div class="bar">
    <div class="logo">${vpin()}Метка</div>
    ${DEMO ? `<span class="demo-flag">демо</span>` : ""}
    <span class="sp"></span>
    ${u.streak ? `<span class="pill" title="Серия дней">🔥 <span class="mono">${u.streak}</span></span>` : ""}
    <button class="me-chip" id="mechip" aria-label="Мой профиль, уровень ${lv}">${avatar(u, 34)}<span class="lv"><b>Ур. ${lv}</b><span class="xpbar"><i style="width:${pct}%"></i></span></span></button>
  </div>`;
}
function bindTopBar() { $("#mechip")?.addEventListener("click", () => setTab("profile")); }

/* ================= feed ================= */
function tile(m) {
  return `<button class="tile r-${m.rarity}" data-open="${esc(m.code)}">
    <div class="ph">${art(m)}<span class="chipe">${esc(m.emoji)}</span><span class="gem">${RARITY[m.rarity]?.t || ""}</span>${m.dist != null ? `<span class="dist">${fmtDist(m.dist)}</span>` : ""}</div>
    <div class="lab"><div class="nm">${esc(m.name)}</div>
      <div class="row2">${avatar(m.owner, 20, false)}<span class="who">${esc(m.owner.nick)}</span>${m.reacts ? `<span>❤️ ${m.reacts}</span>` : ""}</div></div></button>`;
}
document.addEventListener("click", e => { const t = e.target.closest("[data-open]"); if (t) openMark(t.dataset.open); });
function questCard() {
  const q = S.quest; if (!q) return "";
  const pct = Math.round(q.progress / q.n * 100), c = CAT[q.cat];
  return `<section class="quest ${q.done ? "done" : ""}" aria-label="Задание дня">
    <div class="ic">${q.done ? "✅" : q.kind === "collect" ? "🧭" : c.e}</div>
    <div><small>${q.done ? "Задание выполнено" : "Задание дня"}</small><b>${esc(q.t)}</b>
      <div class="qprog"><div class="t"><i style="width:${pct}%"></i></div><span class="mono">${q.progress}/${q.n}</span><span>+${q.xp} XP</span></div></div></section>`;
}
async function renderFeed() {
  view.innerHTML = `<div class="scroll"><div class="page">${topBar()}${dioramaHTML(`<small>Ялта · сегодня</small><b>Что найдём, ${esc(S.me.nick)}?</b><span>Коты, птицы, муралы и странности ждут своих первооткрывателей</span>`)}${questCard()}
    <div class="seg" role="group" aria-label="Сортировка">
      ${[["new", "Новые"], ["near", "Рядом"], ["top", "Любимые"]].map(([k, t]) => `<button data-sort="${k}" aria-pressed="${S.feedSort === k}">${t}</button>`).join("")}
    </div>
    <div class="chips" role="group" aria-label="Категории"><button class="chip" data-cat="" aria-pressed="${!S.feedCat}">Все</button>${CATS.map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${S.feedCat === c.id}">${c.e} ${c.t}</button>`).join("")}</div>
    <div id="feed" class="grid">${'<div class="sk"></div>'.repeat(4)}</div></div></div>`;
  bindTopBar();
  $$("[data-sort]").forEach(b => b.addEventListener("click", () => { H.pick(); S.feedSort = b.dataset.sort; renderFeed(); }));
  $$("[data-cat]").forEach(b => b.addEventListener("click", () => { H.pick(); S.feedCat = b.dataset.cat; renderFeed(); }));
  let qs = `sort=${S.feedSort}${S.feedCat ? "&cat=" + S.feedCat : ""}`;
  if (S.feedSort === "near") {
    const pos = GEO.pos || await getLocation();
    if (!pos) { $("#feed").outerHTML = `<div class="empty"><div class="big">🧭</div><h3>Нужна геопозиция</h3><p>Разреши доступ к местоположению, чтобы видеть метки рядом.</p><button class="btn pri" id="askgeo">Разрешить</button></div>`; $("#askgeo")?.addEventListener("click", () => getLocation().then(renderFeed)); return; }
    qs += `&lat=${pos.lat}&lon=${pos.lon}`;
  }
  try {
    const { marks } = await api("/api/feed?" + qs);
    const el = $("#feed"); if (!el) return;
    el.outerHTML = marks.length ? `<div class="grid">${marks.map(tile).join("")}</div>`
      : `<div class="empty">${crateImg()}<h3>Здесь пока пусто</h3><p>Стань первым: поставь метку, и она появится в ленте у всех.</p><button class="btn pri" id="firstAdd">Поставить метку</button></div>`;
    $("#firstAdd")?.addEventListener("click", openCreate);
  } catch { const el = $("#feed"); if (el) el.outerHTML = `<div class="empty"><div class="big">📡</div><h3>Нет связи</h3><p>Не получилось загрузить ленту. Проверь интернет.</p></div>`; }
}

/* ================= map ================= */
let mapEngine = null;
async function renderMap() {
  view.innerHTML = `<div class="mapwrap"><div class="map" id="map"><div class="tiles"></div><div class="marks"></div></div></div>
    <div class="maptop"><div class="page" style="gap:10px">${topBar()}</div></div>
    <div class="mapbtns"><button class="mbtn" id="zin" aria-label="Приблизить">+</button><button class="mbtn" id="zout" aria-label="Отдалить">−</button><button class="mbtn" id="loc" aria-label="Где я"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg></button></div>
    <div class="attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © CARTO</div>`;
  bindTopBar();
  const start = GEO.pos || { lat: 44.4952, lon: 34.1690 };
  mapEngine = new SlippyMap($("#map"), start, 15);
  $("#zin").onclick = () => mapEngine.zoomBy(1);
  $("#zout").onclick = () => mapEngine.zoomBy(-1);
  $("#loc").onclick = async () => { const p = await getLocation(); if (p) { mapEngine.setMe(p); mapEngine.flyTo(p, 16); } else toast("Не удалось определить местоположение"); };
  if (GEO.pos) mapEngine.setMe(GEO.pos);
  try {
    const [{ marks }, mine] = await Promise.all([api("/api/map"), api(`/api/users/${S.me.id}`)]);
    const got = new Set((mine.collected || []).map(m => m.code));
    mapEngine?.setMarks(marks.map(m => ({ ...m, got: got.has(m.code), mine: m.owner.id === S.me.id })), m => showPeek(m));
  } catch { toast("Не удалось загрузить карту меток"); }
}
function showPeek(m) {
  $(".peek")?.remove(); document.body.classList.toggle("peeking", !!m);
  if (!m) return;
  const d = GEO.pos && hasGeo(m) ? fmtDist(distM(GEO.pos, m)) : "";
  const el = document.createElement("button"); el.className = "peek r-" + m.rarity;
  el.innerHTML = `<div class="ph">${art(m)}</div><div class="t"><span class="gem" style="position:static;justify-self:start;color:var(--ink);background:var(--s2)">${RARITY[m.rarity].t}</span><b>${esc(m.emoji)} ${esc(m.name)}</b><span>${esc(m.owner.nick)}${d ? " · " + d : ""}</span></div><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>`;
  el.onclick = () => openMark(m.code);
  view.appendChild(el);
}

class SlippyMap {
  constructor(el, center, zoom) {
    this.el = el; this.tiles = el.querySelector(".tiles"); this.marksEl = el.querySelector(".marks");
    this.z = zoom; this.c = center; this.cache = new Map(); this.marks = []; this.me = null; this.sel = null;
    this.dark = document.documentElement.dataset.theme !== "light";
    this.ptrs = new Map(); this.raf = 0;
    this.onResize = () => this.draw(); window.addEventListener("resize", this.onResize);
    el.addEventListener("pointerdown", e => this.down(e)); el.addEventListener("pointermove", e => this.move(e));
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => el.addEventListener(t, e => this.up(e)));
    el.addEventListener("wheel", e => { e.preventDefault(); this.zoomAt(-e.deltaY * .0025, e.offsetX, e.offsetY); }, { passive: false });
    el.addEventListener("dblclick", e => this.zoomAt(1, e.offsetX, e.offsetY));
    this.draw();
  }
  destroy() { window.removeEventListener("resize", this.onResize); cancelAnimationFrame(this.raf); cancelAnimationFrame(this.fly); }
  world(lat, lon, z = this.z) { const s = 256 * 2 ** z, sin = Math.sin(lat * Math.PI / 180); return { x: (lon + 180) / 360 * s, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }; }
  unworld(x, y, z = this.z) { const s = 256 * 2 ** z, lon = x / s * 360 - 180, n = Math.PI - 2 * Math.PI * y / s; return { lat: 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n))), lon }; }
  size() { return { w: this.el.clientWidth, h: this.el.clientHeight }; }
  screen(lat, lon) { const { w, h } = this.size(), c = this.world(this.c.lat, this.c.lon), p = this.world(lat, lon); return { x: p.x - c.x + w / 2, y: p.y - c.y + h / 2 }; }
  draw() { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this._draw()); }
  _draw() {
    const { w, h } = this.size(), tz = Math.max(2, Math.min(19, Math.round(this.z))), k = 2 ** (this.z - tz), ts = 256 * k;
    const c = this.world(this.c.lat, this.c.lon, tz), cx = c.x * k, cy = c.y * k;
    const x0 = Math.floor((cx - w / 2) / ts), x1 = Math.floor((cx + w / 2) / ts), y0 = Math.floor((cy - h / 2) / ts), y1 = Math.floor((cy + h / 2) / ts), n = 2 ** tz;
    const want = new Set();
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      const wx = ((x % n) + n) % n, key = `${tz}/${wx}/${y}`; want.add(key);
      let img = this.cache.get(key);
      if (!img) { img = new Image(); img.decoding = "async"; img.alt = ""; img.src = `https://${"abcd"[(wx + y) % 4]}.basemaps.cartocdn.com/${this.dark ? "dark_all" : "rastertiles/voyager"}/${key}@2x.png`; img.onerror = () => { img.style.visibility = "hidden"; }; this.cache.set(key, img); this.tiles.appendChild(img); }
      img.style.width = img.style.height = ts + 1 + "px";
      img.style.transform = `translate(${Math.round(x * ts - cx + w / 2)}px,${Math.round(y * ts - cy + h / 2)}px)`;
    }
    for (const [key, img] of this.cache) if (!want.has(key)) { img.remove(); this.cache.delete(key); }
    for (const m of this.marks) { const p = this.screen(m.lat, m.lon); m._el.style.left = p.x + "px"; m._el.style.top = p.y + "px"; m._el.hidden = p.x < -60 || p.y < -60 || p.x > w + 60 || p.y > h + 80; }
    if (this.me) { const p = this.screen(this.me.lat, this.me.lon); this.meEl.style.left = p.x + "px"; this.meEl.style.top = p.y + "px"; }
  }
  setMarks(list, onPick) {
    this.marksEl.querySelectorAll(".mk").forEach(e => e.remove());
    this.marks = list.map(m => {
      const el = document.createElement("button"); el.className = `mk r-${m.rarity}${m.mine ? " mine" : ""}${m.got ? " got" : ""}`;
      el.setAttribute("aria-label", m.name); el.innerHTML = `<span class="bub">${esc(m.emoji)}</span><img class="stem" src="${VA.pin(RCOL[m.rarity])}" alt="">`;
      el.addEventListener("click", ev => { ev.stopPropagation(); H.pick(); this.marks.forEach(x => x._el.classList.remove("sel")); el.classList.add("sel"); onPick(m); });
      this.marksEl.appendChild(el); return { ...m, _el: el };
    });
    this.draw();
  }
  setMe(p) { this.me = p; if (!this.meEl) { this.meEl = document.createElement("div"); this.meEl.className = "medot"; this.marksEl.appendChild(this.meEl); } this.draw(); }
  down(e) { if (e.target.closest(".mk")) return; this.el.setPointerCapture?.(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = false; cancelAnimationFrame(this.fly); }
  move(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    const prev = this.ptrs.get(e.pointerId), cur = { x: e.clientX, y: e.clientY };
    if (this.ptrs.size === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y; if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
      const c = this.world(this.c.lat, this.c.lon); this.c = this.unworld(c.x - dx, c.y - dy);
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.entries()].map(([id, p]) => id === e.pointerId ? cur : p);
      const [pa, pb] = [...this.ptrs.values()];
      const d0 = Math.hypot(pa.x - pb.x, pa.y - pb.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 > 0) { const r = this.el.getBoundingClientRect(); this.zoomAt(Math.log2(d1 / d0), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
      this.moved = true;
    }
    this.ptrs.set(e.pointerId, cur); this.draw();
  }
  up(e) { if (this.ptrs.delete(e.pointerId) && !this.moved && !this.ptrs.size && !e.target.closest?.(".mk")) { this.marks.forEach(x => x._el.classList.remove("sel")); showPeek(null); } }
  zoomAt(dz, sx, sy) {
    const nz = Math.max(3, Math.min(19, this.z + dz)); if (nz === this.z) return;
    const { w, h } = this.size(), c = this.world(this.c.lat, this.c.lon), pt = this.unworld(c.x + sx - w / 2, c.y + sy - h / 2);
    this.z = nz; const p2 = this.world(pt.lat, pt.lon); this.c = this.unworld(p2.x - sx + w / 2, p2.y - sy + h / 2); this.draw();
  }
  zoomBy(d) { const { w, h } = this.size(); H.pick(); this.animate(this.c, this.z + d, w / 2, h / 2); }
  flyTo(p, z) { this.animate(p, z); }
  animate(target, tz) {
    cancelAnimationFrame(this.fly); const s = { ...this.c }, sz = this.z, t0 = performance.now(), D = 450;
    const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - (1 - k) ** 3; this.c = { lat: s.lat + (target.lat - s.lat) * e, lon: s.lon + (target.lon - s.lon) * e }; this.z = Math.max(3, Math.min(19, sz + (tz - sz) * e)); this._draw(); if (k < 1) this.fly = requestAnimationFrame(step); };
    this.fly = requestAnimationFrame(step);
  }
}

/* ================= top ================= */
async function renderTop() {
  view.innerHTML = `<div class="scroll"><div class="page">${topBar()}
    <div class="seg" role="group" aria-label="Период">${[["week", "Неделя"], ["all", "Всё время"]].map(([k, t]) => `<button data-per="${k}" aria-pressed="${S.topPeriod === k}">${t}</button>`).join("")}</div>
    <div id="lb"><div class="sk" style="aspect-ratio:3/1"></div></div></div></div>`;
  bindTopBar();
  $$("[data-per]").forEach(b => b.addEventListener("click", () => { H.pick(); S.topPeriod = b.dataset.per; renderTop(); }));
  try {
    const { rows } = await api("/api/top?period=" + S.topPeriod);
    const el = $("#lb"); if (!el) return;
    if (!rows.length) { el.innerHTML = `<div class="empty"><div class="big">🏆</div><h3>Топ пока пуст</h3><p>Ставь и собирай метки, и ты окажешься здесь первым.</p></div>`; return; }
    const pod = [rows[1], rows[0], rows[2]].map((u, i) => u ? `<button class="pod p${[2, 1, 3][i]}" data-user="${u.id}">${avatar(u, [58, 76, 58][i])}<b>${esc(u.nick)}</b><small>${u.score} XP</small><div class="ped">${[2, 1, 3][i]}</div></button>` : "<span></span>").join("");
    el.innerHTML = `<div class="podium">${pod}</div><div class="lb" style="margin-top:16px">${rows.slice(3).map(u => `<button class="lrow ${u.id === S.me.id ? "me" : ""}" data-user="${u.id}"><span class="rk">${u.rank}</span>${avatar(u, 40)}<span class="t"><b>${esc(u.nick)}</b><span>Ур. ${u.level} · ${esc(u.status)}</span></span><span class="sc">${u.score}</span></button>`).join("")}</div>
      ${rows.some(u => u.id === S.me.id) ? "" : `<p class="hint" style="text-align:center">Тебя пока нет в топе. Поставь пару меток, и ты здесь появишься.</p>`}`;
  } catch { $("#lb").innerHTML = `<div class="empty"><div class="big">📡</div><h3>Нет связи</h3></div>`; }
}
document.addEventListener("click", e => { const t = e.target.closest("[data-user]"); if (t) { const id = +t.dataset.user; if (id === S.me.id && !S.stack.length) setTab("profile"); else openProfile(id); } });

/* ================= profile ================= */
function profileHTML(d, isMe) {
  const u = d.user, s = d.stats, lv = u.level, f = levelFloor(lv), c = levelCeil(lv), pct = Math.max(0, Math.min(1, (u.xp - f) / (c - f)));
  const R = 44, L = 2 * Math.PI * R;
  const st = STATUSES.find(x => x.e === u.status);
  const cc = (COLOR[u.color] || COLORS[0]).a;
  return `<section class="hero" style="${cvars(u.color)}"><img class="hcr a" data-depth="0.18" src="${VA.crystal(cc)}" alt=""><img class="hcr b" data-depth="0.34" src="${VA.crystal(RCOL.legend)}" alt="">
    <div class="hero-row">
      <div class="ring"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="${R}" fill="none" stroke="var(--s3)" stroke-width="5"/><circle cx="48" cy="48" r="${R}" fill="none" stroke="var(--acc)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - pct)}"/></svg>${avatar(u, 78, false)}<span class="lvl">Ур. ${lv}</span></div>
      <div style="min-width:0"><h2>${esc(u.nick)}</h2><span class="stt">${esc(u.status)} ${esc(st?.t || "")}</span></div>
    </div>
    ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ""}
    <div class="xpline"><div style="display:flex;justify-content:space-between"><span>Опыт</span><span class="mono">${u.xp} / ${c} XP</span></div><div class="t"><i style="width:${pct * 100}%"></i></div></div>
    ${isMe ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn dark" id="editP">Изменить</button><button class="btn soft" id="pickS">Статусы ${S.statuses.length}/${STATUSES.length}</button></div>` : ""}
  </section>
  <div class="stats">
    <div class="stat"><b>${s.created}</b><span>меток</span></div>
    <div class="stat"><b>${s.collected}</b><span>собрано</span></div>
    <div class="stat"><b>${s.likes}</b><span>реакций</span></div>
    <div class="stat"><b>${s.streak}🔥</b><span>серия</span></div>
  </div>
  <div class="seg" role="group" aria-label="Раздел профиля">
    <button data-ptab="marks" aria-pressed="true">Метки ${d.marks.length}</button>
    <button data-ptab="col" aria-pressed="false">Собранные ${d.collected.length}</button>
    <button data-ptab="ach" aria-pressed="false">Награды</button>
  </div>
  <div id="ptab"></div>`;
}
function bindProfile(root, d, isMe) {
  const tabs = {
    marks: () => d.marks.length ? `<div class="grid">${d.marks.map(tile).join("")}</div>` : `<div class="empty"><div class="big">📸</div><h3>${isMe ? "Твоя первая метка ждёт" : "Пока без меток"}</h3>${isMe ? `<p>Нажми жёлтый плюс внизу и сфоткай что-нибудь интересное.</p>` : ""}</div>`,
    col: () => d.collected.length ? `<div class="grid">${d.collected.map(tile).join("")}</div>` : `<div class="empty"><div class="big">🧭</div><h3>Ещё ничего не собрано</h3><p>Подойди к чужой метке ближе ${COLLECT_RADIUS_M} м и нажми «Собрать».</p></div>`,
    ach: () => `<div class="ach">${ACHIEVEMENTS.map(a => { const ok = a.ok(d.stats); return `<div class="badge ${ok ? "" : "off"}"><span class="i">${a.i}</span><span><b>${a.t}</b><span>${ok ? "Получено" : a.d}</span></span></div>`; }).join("")}</div>`,
  };
  const show = k => { $$("[data-ptab]", root).forEach(b => b.setAttribute("aria-pressed", b.dataset.ptab === k)); $("#ptab", root).innerHTML = tabs[k](); };
  $$("[data-ptab]", root).forEach(b => b.addEventListener("click", () => { H.pick(); show(b.dataset.ptab); }));
  show("marks");
  if (isMe) { $("#editP", root)?.addEventListener("click", () => openEditProfile()); $("#pickS", root)?.addEventListener("click", () => openStatuses()); }
}
async function renderProfile() {
  view.innerHTML = `<div class="scroll"><div class="page">${topBar()}<div id="prof"><div class="sk" style="aspect-ratio:2/1"></div></div></div></div>`;
  bindTopBar();
  try {
    const d = await api(`/api/users/${S.me.id}`);
    const el = $("#prof"); if (!el) return;
    el.outerHTML = `<div class="page" id="prof" style="gap:18px">${profileHTML(d, true)}</div>`;
    bindProfile($("#prof"), d, true);
  } catch { toast("Не удалось загрузить профиль"); }
}
async function openProfile(id) {
  const el = document.createElement("div"); el.className = "full";
  el.innerHTML = `<div class="det"><div class="det-top"><span></span><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div><div class="sk" style="aspect-ratio:2/1"></div></div>`;
  pushLayer(el); $("[data-close]", el).onclick = () => popLayer(el);
  try {
    const d = await api(`/api/users/${id}`);
    el.querySelector(".det").innerHTML = `<div class="det-top"><span class="lbl">Профиль</span><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>${profileHTML(d, id === S.me.id)}`;
    $("[data-close]", el).onclick = () => popLayer(el);
    bindProfile(el, d, id === S.me.id);
  } catch { popLayer(el); toast("Профиль не найден"); }
}
function openEditProfile(onboarding = false) {
  const draft = { nick: S.me.onboarded ? S.me.nick : (TG?.initDataUnsafe?.user?.first_name || ""), avatar: S.me.avatar, color: S.me.color, bio: S.me.bio || "" };
  const el = document.createElement("div"); el.className = onboarding ? "onb" : "ov";
  const body = `
    ${onboarding ? `${dioramaHTML(`<span class="logo" style="color:#fff">${vpin()}Метка</span>`, "tall")}<div><h1>Создай свой аккаунт исследователя</h1></div><p class="lead">Выбери аватар и цвет. Позже откроешь эмодзи-статусы за находки.</p>` : `<div class="grab"></div><div class="sh-h"><h2>Профиль</h2><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>`}
    <span class="av avbig" id="avp" style="${onboarding ? "" : "justify-self:center;--sz:96px;"}${cvars(draft.color)}">${esc(draft.avatar)}</span>
    <div class="field"><label class="lbl" for="p-nick">Ник</label><input class="inp" id="p-nick" maxlength="24" placeholder="Как тебя называть" value="${esc(draft.nick)}" autocomplete="off"></div>
    <div class="field"><span class="lbl">Аватар</span><div class="emg">${AVATARS.map(a => `<button class="em" data-av="${a}" aria-pressed="${a === draft.avatar}">${a}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Цвет</span><div class="swatches">${COLORS.map(c => `<button class="sw" data-col="${c.id}" aria-pressed="${c.id === draft.color}" aria-label="${c.t}" style="${cvars(c.id)}"></button>`).join("")}</div></div>
    ${onboarding ? "" : `<div class="field"><label class="lbl" for="p-bio">О себе</label><textarea class="inp" id="p-bio" maxlength="120" placeholder="Что ищешь в городе?">${esc(draft.bio)}</textarea></div>`}
    <button class="btn pri w" id="p-save">${onboarding ? "Начать охоту" : "Сохранить"}</button>`;
  el.innerHTML = onboarding ? `<div class="onb-in">${body}</div>` : `<div class="sheet" role="dialog" aria-modal="true"><div class="form">${body}</div></div>`;
  if (onboarding) document.body.appendChild(el); else pushLayer(el);
  const sync = () => { const a = $("#avp", el); a.style.setProperty("--ca", COLOR[draft.color].a); a.style.setProperty("--cb", COLOR[draft.color].b); a.textContent = draft.avatar; };
  $$("[data-av]", el).forEach(b => b.addEventListener("click", () => { H.pick(); draft.avatar = b.dataset.av; $$("[data-av]", el).forEach(x => x.setAttribute("aria-pressed", x === b)); sync(); }));
  $$("[data-col]", el).forEach(b => b.addEventListener("click", () => { H.pick(); draft.color = b.dataset.col; $$("[data-col]", el).forEach(x => x.setAttribute("aria-pressed", x === b)); sync(); }));
  el.addEventListener("click", e => { if (e.target === el && !onboarding) popLayer(el); if (e.target.closest("[data-close]")) popLayer(el); });
  $("#p-save", el).addEventListener("click", async () => {
    const nick = $("#p-nick", el).value.trim();
    if (!nick) { H.err(); $("#p-nick", el).focus(); toast("Придумай ник"); return; }
    $("#p-save", el).disabled = true;
    try {
      await api("/api/me", { method: "POST", body: { nick, avatar: draft.avatar, color: draft.color, bio: $("#p-bio", el)?.value || "", status: S.me.status } });
      await refreshMe(); H.ok();
      if (onboarding) { el.remove(); burst("rare"); chime(1); toast(`Привет, ${nick}! Держи статус 🌱`); boot2(); }
      else { popLayer(el); toast("Профиль сохранён"); renderTab(); }
    } catch { $("#p-save", el).disabled = false; H.err(); toast("Не получилось сохранить"); }
  });
}
function openStatuses() {
  const el = document.createElement("div"); el.className = "ov";
  const s = S.stats;
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><div class="sh-h"><h2>Эмодзи-статусы</h2><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>
    <p class="hint" style="margin:-6px 0 14px">Статус виден рядом с аватаром везде: в ленте, топе и на карточках. Новые открываются за находки.</p>
    <div class="lb">${STATUSES.map(x => { const ok = x.ok(s); return `<button class="lrow ${S.me.status === x.e ? "me" : ""}" data-st="${x.e}" ${ok ? "" : "disabled"} style="${ok ? "" : "opacity:.5"}"><span style="font-size:28px">${x.e}</span><span class="t"><b>${x.t}</b><span>${ok ? (S.me.status === x.e ? "Выбран" : "Открыт · нажми, чтобы выбрать") : "🔒 " + x.d}</span></span></button>`; }).join("")}</div></div>`;
  pushLayer(el);
  el.addEventListener("click", async e => {
    if (e.target === el || e.target.closest("[data-close]")) return popLayer(el);
    const b = e.target.closest("[data-st]"); if (!b || b.disabled) return;
    H.ok();
    try { await api("/api/me", { method: "POST", body: { ...S.me, status: b.dataset.st } }); await refreshMe(); popLayer(el); toast(`Статус ${b.dataset.st} установлен`); renderTab(); } catch { toast("Не получилось"); }
  });
}

/* ================= create ================= */
const ICON = {
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  cam: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  gal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>`,
  loc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>`,
};
function openCreate() {
  const d = { blob: null, url: null, cat: "cat", emoji: "🐈", geo: null, geoSrc: "" };
  const el = document.createElement("div"); el.className = "ov";
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="crh"><div class="grab"></div>
    <div class="sh-h"><h2 id="crh">Новая метка</h2><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>
    <div class="form">
      <div class="field"><span class="lbl">Фото</span><div id="phs"></div></div>
      <div class="field"><span class="lbl">Что нашёл</span><div class="cats" id="cats"></div></div>
      <div class="field"><span class="lbl">Эмодзи</span><div class="emg" id="ems"></div></div>
      <div class="field"><label class="lbl" for="c-name">Имя</label><input class="inp" id="c-name" maxlength="40" autocomplete="off"></div>
      <div class="field"><label class="lbl" for="c-story">История · по желанию</label><textarea class="inp" id="c-story" maxlength="220" placeholder="Спит на тёплом капоте у почты, любит сыр"></textarea></div>
      <div class="field"><label class="lbl" for="c-place">Где это</label><input class="inp" id="c-place" maxlength="60" placeholder="Набережная, у фонтана" autocomplete="off"></div>
      <div class="field"><label class="lbl" for="c-geo">Точка на карте</label><div class="geo-row"><input class="inp mono" id="c-geo" placeholder="44.4952, 34.1663" autocomplete="off"><button class="geo-btn" id="c-loc" aria-label="Моё местоположение">${ICON.loc}</button></div><span class="hint" id="c-geoh">Возьмём из фото или нажми кнопку, чтобы поставить точку там, где стоишь.</span></div>
      <button class="btn pri w" id="c-save" disabled>Поставить метку</button>
    </div></div>`;
  pushLayer(el, () => { if (d.url) URL.revokeObjectURL(d.url); });
  el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-close]")) popLayer(el); });
  const setGeo = (g, src) => { d.geo = g; d.geoSrc = src; $("#c-geo", el).value = g ? `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}` : ""; $("#c-geoh", el).innerHTML = g ? `<span class="ok">✓ ${src}</span>` : "Не похоже на координаты. Пример: 44.4952, 34.1663"; };
  const photo = () => {
    $("#phs", el).innerHTML = d.url
      ? `<div class="preview"><img src="${d.url}" alt="Выбранное фото"><span class="again">Заменить<input type="file" accept="image/*"></span></div>`
      : `<div class="picks"><label class="pick">${ICON.cam}Снять<input type="file" accept="image/*" capture="environment"></label><label class="pick">${ICON.gal}Из галереи<input type="file" accept="image/*"></label></div>`;
    $$("input[type=file]", el).forEach(i => i.addEventListener("change", onFile));
  };
  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const g = readGps(await f.slice(0, 262144).arrayBuffer()); if (g) { setGeo(g, "Координаты из фото"); H.ok(); } } catch {}
    try { const out = await compress(f); d.blob = out.blob; d.tone = out.tone; } catch { d.blob = null; toast("Не получилось прочитать фото"); }
    if (d.url) URL.revokeObjectURL(d.url);
    d.url = d.blob ? URL.createObjectURL(d.blob) : null; photo();
    if (!d.geo) { const p = await getLocation(); if (p && !d.geo) setGeo(p, "Твоё местоположение"); }
  }
  const pickers = () => {
    $("#cats", el).innerHTML = CATS.map(c => `<button class="cat" data-c="${c.id}" aria-pressed="${d.cat === c.id}">${c.e} ${c.t}</button>`).join("");
    $("#ems", el).innerHTML = CAT[d.cat].em.map(x => `<button class="em" data-e="${x}" aria-pressed="${d.emoji === x}">${x}</button>`).join("");
    $("#c-name", el).placeholder = { cat: "Граф Барсик", bird: "Чайка Гоша", tree: "Старый Платон", art: "Глаз на стене", place: "Дверь в никуда", odd: "Синий ботинок" }[d.cat];
  };
  $("#cats", el).addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; H.pick(); d.cat = b.dataset.c; d.emoji = CAT[d.cat].em[0]; pickers(); });
  $("#ems", el).addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (!b) return; H.pick(); d.emoji = b.dataset.e; pickers(); });
  $("#c-name", el).addEventListener("input", () => { $("#c-save", el).disabled = !$("#c-name", el).value.trim(); });
  $("#c-geo", el).addEventListener("change", () => { const v = $("#c-geo", el).value.trim(); if (!v) { d.geo = null; $("#c-geoh", el).textContent = "Без точки метка не появится на карте."; return; } setGeo(parseCoords(v), "Точка задана"); });
  $("#c-loc", el).addEventListener("click", async () => { $("#c-geoh", el).textContent = "Определяем…"; const p = await getLocation(); if (p) { setGeo(p, `Твоё местоположение${p.acc ? ` (±${Math.round(p.acc)} м)` : ""}`); H.ok(); } else { $("#c-geoh", el).textContent = "Нет доступа к геопозиции. Разреши его в настройках или вставь координаты."; H.err(); } });
  $("#c-save", el).addEventListener("click", async () => {
    const btn = $("#c-save", el); btn.disabled = true; btn.textContent = "Ставим метку…";
    const fd = new FormData();
    fd.set("name", $("#c-name", el).value.trim()); fd.set("cat", d.cat); fd.set("emoji", d.emoji);
    fd.set("story", $("#c-story", el).value.trim()); fd.set("place", $("#c-place", el).value.trim());
    if (d.geo) { fd.set("lat", d.geo.lat.toFixed(6)); fd.set("lon", d.geo.lon.toFixed(6)); }
    if (d.blob) { fd.set("photo", d.blob, "photo.jpg"); if (d.tone) fd.set("tone", d.tone); }
    try {
      const r = await api("/api/marks", { method: "POST", body: fd });
      const up = await refreshMe();
      popLayer(el); reveal(r, up);
    } catch (e) {
      H.err(); btn.disabled = false; btn.textContent = "Поставить метку";
      toast({ daily_limit: "На сегодня лимит меток исчерпан", photo_too_large: "Фото слишком большое" }[e.error] || "Не получилось сохранить. Проверь интернет.");
    }
  });
  photo(); pickers();
}

function reveal(r, up) {
  const m = r.mark, rv = RARITY[m.rarity];
  const el = document.createElement("div"); el.className = `ov reveal r-${m.rarity}`;
  const gains = [`+${r.xp} XP`, `Узор «${PATTERNS[patOf(m).m].t}»`]; if (m.seen) gains.push(`ИИ увидел: ${m.seen.e} ${m.seen.ru}`); if (r.questXp) gains.push(`Задание дня +${r.questXp} XP`); if (up.levelUp) gains.push(`Уровень ${up.levelUp}!`); up.newStatuses.forEach(s => gains.push(`Новый статус ${s}`));
  el.innerHTML = `<img class="rv-cr" src="${VA.crystal(RCOL[m.rarity])}" alt=""><div class="flip"><div class="face back">${crateImg()}<span>?</span></div>
    <div class="face front r-${m.rarity}"><div class="ph">${art(m)}<span class="gem">${rv.t}</span></div><div class="lab"><div class="nm">${esc(m.emoji)} ${esc(m.name)}</div><span class="mono" style="font-size:12px;color:var(--mut)">№${String(m.num).padStart(4, "0")} · ${m.code}</span></div></div></div>
    <h3>Метка поставлена<em>${rv.t}</em></h3>
    <div class="xpgain">${gains.map(g => `<span>${esc(g)}</span>`).join("")}</div>
    <button class="btn pri" id="rv-ok">Открыть карточку</button>`;
  pushLayer(el);
  const lvl = { common: 0, rare: 1, epic: 2, legend: 2 }[m.rarity];
  setTimeout(() => { m.rarity === "legend" ? H.seq(4) : m.rarity === "epic" ? H.seq(2) : H.ok(); chime(lvl); if (m.rarity !== "common" || up.levelUp) burst(m.rarity === "common" ? "rare" : m.rarity); }, 900);
  $("#rv-ok", el).onclick = () => { popLayer(el); renderTab(); openMark(m.code); };
}
function burst(r) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "burst"; document.body.appendChild(cv);
  const dpr = devicePixelRatio || 1; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const cols = { rare: ["#4D8BFF", "#9CC0FF", "#fff", "#FFD43B"], epic: ["#A66BFF", "#E0B6FF", "#FFD43B"], legend: ["#FFB020", "#FFE48A", "#fff", "#FF8A3D"] }[r] || ["#FFD43B", "#fff"];
  const P = Array.from({ length: r === "legend" ? 160 : 90 }, () => ({ x: innerWidth / 2, y: innerHeight * .4, vx: (Math.random() - .5) * 15, vy: -Math.random() * 15 - 3, s: Math.random() * 7 + 3, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6 }));
  let t = 0; (function f() { g.clearRect(0, 0, innerWidth, innerHeight); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.vx *= .99; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }); if (++t < 120) requestAnimationFrame(f); else cv.remove(); })();
}

/* ================= mark detail ================= */
async function openMark(code) {
  const el = document.createElement("div"); el.className = "full";
  el.innerHTML = `<div class="det"><div class="det-top"><span></span><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div><div class="sk" style="aspect-ratio:4/5"></div></div>`;
  pushLayer(el); $("[data-close]", el).onclick = () => popLayer(el);
  let d;
  try { d = await api(`/api/marks/${code}`); } catch { popLayer(el); toast("Метка не найдена"); return; }
  const draw = () => {
    const m = d.mark, geo = hasGeo(m), dist = GEO.pos && geo ? distM(GEO.pos, m) : null;
    const canCollect = !d.mine && !d.collected;
    el.querySelector(".det").innerHTML = `
      <div class="det-top"><span class="lbl">Метка №${String(m.num).padStart(4, "0")}</span><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>
      <div class="stage"><article class="bigcard r-${m.rarity}" id="bc">
        <div class="ph">${art(m)}<span class="chipe">${esc(m.emoji)}</span><span class="gem">${RARITY[m.rarity].t}</span><span class="num mono">${m.code}</span><div class="glare"></div></div>
        <div class="body"><h1>${esc(m.name)}</h1>${m.story ? `<p class="story">${esc(m.story)}</p>` : ""}
          <button class="owner" data-user="${m.owner.id}">${avatar(m.owner, 42)}<span class="ot"><b>${esc(m.owner.nick)}</b><span>Первооткрыватель · ур. ${m.owner.level}</span></span></button>
          <dl class="spec"><dt>Вид</dt><dd>${CAT[m.cat]?.e} ${CAT[m.cat]?.t}</dd><dt>Найдена</dt><dd>${fmtDate(m.at)}</dd>${m.place ? `<dt>Где</dt><dd>${esc(m.place)}</dd>` : ""}${dist != null ? `<dt>До неё</dt><dd>${fmtDist(dist)}</dd>` : ""}<dt>Собрали</dt><dd>${m.collects} ${plural(m.collects, "человек", "человека", "человек")}</dd>
          <dt>Узор</dt><dd><span class="patchip" style="background-image:url(${patternURL(patOf(m), m.code)})"></span>${PATTERNS[patOf(m).m].t}</dd>
          ${m.seen ? `<dt>ИИ увидел</dt><dd>${esc(m.seen.e)} ${esc(m.seen.ru)} · ${m.seen.conf}%</dd>` : ""}</dl>
        </div></article></div>
      <div class="reacts">${REACTIONS.map(e => `<button class="rx" data-rx="${e}" aria-pressed="${d.myReaction === e}">${e}${d.reactions[e] ? `<b>${d.reactions[e]}</b>` : ""}</button>`).join("")}</div>
      <div class="acts">
        ${canCollect ? `<button class="btn teal span collect" id="m-col"><span class="meter" style="width:${dist != null ? Math.max(0, Math.min(100, 100 - (dist - COLLECT_RADIUS_M) / 20)) : 0}%"></span><span style="position:relative">🧭 ${geo ? (dist != null ? (dist <= COLLECT_RADIUS_M ? "Собрать метку!" : `Собрать · подойди ближе (${fmtDist(dist)})`) : "Собрать метку") : "Собрать метку"}</span></button>` : ""}
        ${d.collected ? `<div class="btn soft span" style="pointer-events:none">✅ Метка в твоей коллекции</div>` : ""}
        ${geo ? `<button class="btn ${canCollect ? "soft" : "pri"} span" id="m-route">${ICON.route}Маршрут пешком</button>` : ""}
        <button class="btn soft" id="m-send">${ICON.send}Отправить</button>
        <button class="btn soft" id="m-qr">${ICON.qr}QR-код</button>
        ${m.photo && TG?.shareToStory ? `<button class="btn soft span" id="m-story">📲 В историю</button>` : ""}
        ${d.mine ? `<button class="btn danger span" id="m-del">Удалить метку</button>` : ""}
      </div>
      ${d.collectors.length ? `<div class="collectors"><div class="stack">${d.collectors.map(u => avatar(u, 30, false)).join("")}</div><span>Нашли: ${d.collectors.slice(0, 2).map(u => esc(u.nick)).join(", ")}${m.collects > 2 ? ` и ещё ${m.collects - 2}` : ""}</span></div>` : ""}`;
    $("[data-close]", el).onclick = () => popLayer(el);
    tilt($("#bc", el));
    $$("[data-rx]", el).forEach(b => b.onclick = async () => {
      H.pick(); const e = b.dataset.rx;
      try { const r = await api(`/api/marks/${m.code}/react`, { method: "POST", body: { emoji: e } }); d.reactions = r.reactions; d.myReaction = r.myReaction; draw(); if (r.myReaction) b.animate?.([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], 250); } catch { toast("Не получилось"); }
    });
    $("#m-route", el)?.addEventListener("click", () => openLink(`https://yandex.ru/maps/?rtext=${GEO.pos ? `${GEO.pos.lat},${GEO.pos.lon}` : ""}~${m.lat},${m.lon}&rtt=pd`));
    $("#m-send", el).onclick = () => openTgLink(`https://t.me/share/url?url=${encodeURIComponent(appLink(m.code))}&text=${encodeURIComponent(`${m.emoji} Нашёл метку «${m.name}». Сможешь собрать?`)}`);
    $("#m-qr", el).onclick = () => showQr(m);
    $("#m-story", el)?.addEventListener("click", () => { try { TG.shareToStory(m.photo, { text: `${m.emoji} ${m.name} — найди меня в Метке`, widget_link: { url: appLink(m.code), name: "Открыть метку" } }); } catch { toast("Истории недоступны"); } });
    $("#m-col", el)?.addEventListener("click", async () => {
      const btn = $("#m-col", el); btn.disabled = true;
      let pos = null;
      if (geo) { pos = await getLocation(); if (!pos) { btn.disabled = false; H.err(); toast("Нужна геопозиция, чтобы собрать метку"); return; } }
      try {
        const r = await api(`/api/marks/${m.code}/collect`, { method: "POST", body: { ...(pos || {}), demoNear: DEMO } });
        const up = await refreshMe(); d.collected = true; d.mark.collects++; d.collectors.unshift({ id: S.me.id, nick: S.me.nick, avatar: S.me.avatar, color: S.me.color });
        H.seq(2); chime(1); burst(m.rarity === "common" ? "rare" : m.rarity);
        toast(`Собрано! +${r.xp} XP${r.questXp ? ` и задание дня +${r.questXp}` : ""}${up.levelUp ? ` · уровень ${up.levelUp}!` : ""}`, 3400);
        draw();
      } catch (e) {
        btn.disabled = false; H.err();
        toast({ too_far: `Ещё далеко: ${fmtDist(e.dist)}. Подойди ближе ${COLLECT_RADIUS_M} м`, already: "Уже в коллекции", own_mark: "Это твоя метка", need_location: "Нужна геопозиция" }[e.error] || "Не получилось собрать");
      }
    });
    const del = $("#m-del", el); let armed = false;
    del?.addEventListener("click", async () => {
      if (!armed) { armed = true; del.textContent = "Точно удалить? Нажми ещё раз"; H.err(); setTimeout(() => { if (armed && del.isConnected) { armed = false; del.textContent = "Удалить метку"; } }, 4000); return; }
      del.disabled = true;
      try { await api(`/api/marks/${m.code}`, { method: "DELETE" }); popLayer(el); await refreshMe(); renderTab(); toast("Метка удалена"); } catch { del.disabled = false; toast("Не получилось удалить"); }
    });
  };
  draw();
  if (hasGeo(d.mark) && !d.mine && !d.collected) getLocation().then(p => { if (p && el.isConnected) draw(); });
}
function tilt(card) {
  if (!card || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let raf = 0;
  const mv = (x, y) => { const r = card.getBoundingClientRect(), px = (x - r.left) / r.width, py = (y - r.top) / r.height; cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { card.style.transform = `rotateY(${(px - .5) * 14}deg) rotateX(${(.5 - py) * 14}deg)`; card.style.setProperty("--gx", px * 100 + "%"); card.style.setProperty("--gy", py * 100 + "%"); card.style.setProperty("--ga", Math.round(px * 360)); }); };
  card.addEventListener("pointermove", e => mv(e.clientX, e.clientY));
  card.addEventListener("touchmove", e => { const t = e.touches[0]; t && mv(t.clientX, t.clientY); }, { passive: true });
  const reset = () => { card.style.transform = ""; }; card.addEventListener("pointerleave", reset); card.addEventListener("touchend", reset);
}
function showQr(m) {
  const el = document.createElement("div"); el.className = "ov"; el.style.alignItems = "center"; el.style.padding = "20px";
  el.innerHTML = `<div class="qr-box" role="dialog" aria-label="QR-код метки"><div class="nm">${esc(m.emoji)} ${esc(m.name)}</div><div id="qrs"></div><span class="mono" style="font-size:13px">${m.code}</span><p>Друг наводит камеру телефона, и метка открывается прямо в Telegram.</p><button class="btn dark" id="qr-ok">Готово</button></div>`;
  pushLayer(el);
  const q = QR.encode(appLink(m.code)), px = 8, mg = 3, n = q.size + mg * 2, c = document.createElement("canvas"); c.width = c.height = n * px;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#12151C";
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) g.fillRect((x + mg) * px, (y + mg) * px, px, px);
  $("#qrs", el).appendChild(c); H.ok();
  el.addEventListener("click", e => { if (e.target === el || e.target.id === "qr-ok") popLayer(el); });
}

/* ================= boot ================= */
function boot2() {
  const sp = TG?.initDataUnsafe?.start_param || "", qs = new URLSearchParams(location.search);
  const code = sp.startsWith("m_") ? sp.slice(2) : (qs.get("m") || "");
  setTab(qs.get("tab") === "top" ? "top" : "feed");
  if (code) openMark(code.toUpperCase());
}
new MutationObserver(() => PX.refresh()).observe(document.body, { childList: true, subtree: true });
(async function boot() {
  view.innerHTML = `<div class="scroll"><div class="page"><div class="sk" style="aspect-ratio:4/1"></div><div class="grid"><div class="sk"></div><div class="sk"></div></div></div></div>`;
  try { await refreshMe(); }
  catch (e) { view.innerHTML = `<div class="scroll"><div class="empty" style="padding-top:30vh"><div class="big">📡</div><h3>${e.error === "unauthorized" ? "Открой Метку через Telegram" : "Нет связи с сервером"}</h3><p>${e.error === "unauthorized" ? "Приложение работает внутри бота." : "Проверь интернет и открой приложение снова."}</p></div></div>`; return; }
  if (!S.me.onboarded) openEditProfile(true); else boot2();
})();
