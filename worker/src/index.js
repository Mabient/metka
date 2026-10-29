// Метка — Telegram bot + API on Cloudflare Workers (D1 database).
import {
  CATS, RARITY, STATUSES, REACTIONS, COLLECT_RADIUS_M, AVATARS, COLORS,
  level, questOf, dayKey, distM, rollRarity, unlockedStatuses, detectSubject, makePattern,
  CASE_ITEM, rollCaseItem, caseStrip, DUP_XP, STRIP_WIN, CASE_TIERS, TIER_IDS,
} from "../../shared/rules.js";

const CAT_IDS = new Set(CATS.map(c => c.id));
const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PHOTO = 1_600_000;

// Tables are created on first use, so a fresh database needs no manual setup.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, nick TEXT, avatar TEXT, color TEXT, status TEXT, bio TEXT, xp INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, last_day TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS marks (code TEXT PRIMARY KEY, owner INTEGER NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL, cat TEXT NOT NULL, story TEXT, place TEXT, lat REAL, lon REAL, photo_id TEXT, rarity TEXT NOT NULL, num INTEGER NOT NULL, created_at INTEGER NOT NULL, pattern TEXT, seen TEXT)`,
  `CREATE INDEX IF NOT EXISTS marks_owner ON marks(owner, created_at)`,
  `CREATE INDEX IF NOT EXISTS marks_time ON marks(created_at)`,
  `CREATE INDEX IF NOT EXISTS marks_geo ON marks(lat, lon)`,
  `CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collects (user_id INTEGER NOT NULL, code TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, code))`,
  `CREATE INDEX IF NOT EXISTS collects_code ON collects(code)`,
  `CREATE TABLE IF NOT EXISTS reactions (user_id INTEGER NOT NULL, code TEXT NOT NULL, emoji TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, code))`,
  `CREATE INDEX IF NOT EXISTS reactions_code ON reactions(code)`,
  `CREATE TABLE IF NOT EXISTS xp_log (user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS xp_log_at ON xp_log(at, user_id)`,
  `CREATE TABLE IF NOT EXISTS quest_claims (user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day))`,
  `CREATE TABLE IF NOT EXISTS user_cases (user_id INTEGER PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_daily TEXT)`,
  `CREATE TABLE IF NOT EXISTS user_items (user_id INTEGER NOT NULL, item TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, item))`,
];
let schemaReady = null;
const ensureSchema = env => (schemaReady ??= (async () => {
  await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q)));
  for (const col of ["banner TEXT", "role TEXT", "banned INTEGER DEFAULT 0", "verified INTEGER DEFAULT 0", "tg_photo TEXT", "skin TEXT"])
    try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch {} // already there
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_log (admin INTEGER NOT NULL, action TEXT NOT NULL, target TEXT, at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS case_inv (user_id INTEGER NOT NULL, tier TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, tier))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, serial INTEGER NOT NULL, owner INTEGER NOT NULL, from_user INTEGER, pinned INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS gifts_owner ON gifts(owner)"),
    // move cases from the first version (one shared counter) into the common tier
    env.DB.prepare("INSERT OR IGNORE INTO case_inv (user_id, tier, count) SELECT user_id, 'common', count FROM user_cases WHERE count > 0"),
    env.DB.prepare("UPDATE user_cases SET count = 0 WHERE count > 0"),
  ]);
})().catch(e => { schemaReady = null; throw e; }));

/* ---------- Telegram stickers (official animated duck set) ---------- */
let stickerSet = null;
async function sticker(env, chatId, ...emojis) {
  try {
    stickerSet ??= tg(env, "getStickerSet", { name: env.STICKER_SET || "UtyaDuck" }).then(r => { if (!r.ok) stickerSet = null; return r.ok ? r.result.stickers : []; });
    const list = await stickerSet;
    for (const e of emojis) {
      const pick = list.find(s => s.emoji === e) || list.find(s => (s.emoji || "").includes(e));
      if (pick) return await tg(env, "sendSticker", { chat_id: chatId, sticker: pick.file_id });
    }
  } catch {}
}
// Webhook secret is derived from the bot token, so the token is the only secret to configure.
const webhookSecret = async env => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("metka-webhook:" + env.BOT_TOKEN))).slice(0, 48);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    try {
      if (!env.BOT_TOKEN) return json({ error: "BOT_TOKEN is not set" }, 500);
      await ensureSchema(env);
      if (url.pathname === "/tg" && req.method === "POST") return await onUpdate(req, env, ctx);
      if (url.pathname === "/setup") return await setup(url, env);
      if (url.pathname.startsWith("/img/")) return await image(url.pathname.slice(5), env);
      if (url.pathname === "/") return new Response("Метка API работает ✅", { headers: { "content-type": "text/plain; charset=utf-8" } });
      if (url.pathname.startsWith("/api/")) return cors(await api(req, url, env, ctx));
      return cors(json({ error: "not_found" }, 404));
    } catch (e) {
      console.error(e);
      return cors(json({ error: "server_error", message: String(e?.message || e) }, 500));
    }
  },
};

/* ---------------- helpers ---------------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "content-type, x-init-data");
  h.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const randId = (n, abc = ABC) => { const r = crypto.getRandomValues(new Uint32Array(n)); let s = ""; for (const x of r) s += abc[x % abc.length]; return s; };
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const parseJson = v => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const num = v => (v === null || v === undefined || v === "" || !Number.isFinite(+v)) ? null : +v;

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, typeof msg === "string" ? new TextEncoder().encode(msg) : msg);
}
// Telegram Mini App login check: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData, token) {
  if (!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash"); if (!hash) return null;
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), token);
  const sig = hex(await hmac(secret, dcs));
  if (sig.length !== hash.length) return null;
  let diff = 0; for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff) return null;
  const age = Date.now() / 1000 - Number(p.get("auth_date") || 0);
  if (age > 7 * 86400) return null;
  try { return JSON.parse(p.get("user") || "null"); } catch { return null; }
}

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: false }));
}
const appLink = (env, param) => `https://t.me/${env.BOT_USERNAME}${param ? "?start=" + param : ""}`;

/* ---------------- users, xp, streaks ---------------- */
async function upsertUser(env, u) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users (id, username, first_name, tg_photo, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET username = ?2, first_name = ?3, tg_photo = COALESCE(?4, tg_photo)`
  ).bind(u.id, u.username || null, clean(u.first_name, 64), /^https:\/\/t\.me\//.test(u.photo_url || "") ? u.photo_url : null, now).run();
  // The owner from the config is always owner and verified, and can never be banned.
  if (isOwnerId(env, u.id)) await env.DB.prepare("UPDATE users SET role = 'owner', verified = 1, banned = 0 WHERE id = ?").bind(u.id).run();
  return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
}
async function addCases(env, userId, n, tier = "common") {
  if (n > 0 && CASE_TIERS[tier]) await env.DB.prepare("INSERT INTO case_inv (user_id, tier, count) VALUES (?, ?, ?) ON CONFLICT(user_id, tier) DO UPDATE SET count = count + excluded.count").bind(userId, tier, n).run();
}
// Returns how many levels were gained; every new level gives a case.
async function addXp(env, userId, amount, reason) {
  if (!amount) return 0;
  const before = (await env.DB.prepare("SELECT xp FROM users WHERE id = ?").bind(userId).first("xp")) || 0;
  const ups = level(before + amount) - level(before);
  if (ups > 0) await addCases(env, userId, ups);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET xp = xp + ? WHERE id = ?").bind(amount, userId),
    env.DB.prepare("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, ?, ?, ?)").bind(userId, amount, reason, Date.now()),
  ]);
  return ups;
}
async function touchStreak(env, user) {
  const today = dayKey(), yesterday = dayKey(Date.now() - 86400e3);
  if (user.last_day === today) return user.streak;
  const streak = user.last_day === yesterday ? user.streak + 1 : 1;
  await env.DB.prepare("UPDATE users SET streak = ?, best_streak = MAX(best_streak, ?), last_day = ? WHERE id = ?")
    .bind(streak, streak, today, user.id).run();
  return streak;
}
async function stats(env, userId) {
  const [created, cats, rar, collected, likes, u, rank] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM marks WHERE owner = ?").bind(userId).first("n"),
    env.DB.prepare("SELECT cat, COUNT(*) n FROM marks WHERE owner = ? GROUP BY cat").bind(userId).all(),
    env.DB.prepare("SELECT rarity, COUNT(*) n FROM marks WHERE owner = ? GROUP BY rarity").bind(userId).all(),
    env.DB.prepare("SELECT COUNT(*) n FROM collects WHERE user_id = ?").bind(userId).first("n"),
    env.DB.prepare("SELECT COUNT(*) n FROM reactions r JOIN marks m ON m.code = r.code WHERE m.owner = ? AND r.user_id != ?").bind(userId, userId).first("n"),
    env.DB.prepare("SELECT xp, streak, best_streak FROM users WHERE id = ?").bind(userId).first(),
    weeklyRank(env, userId),
  ]);
  const s = {
    created: created || 0, collected: collected || 0, likes: likes || 0,
    cats: Object.fromEntries((cats.results || []).map(r => [r.cat, r.n])),
    rar: Object.fromEntries((rar.results || []).map(r => [r.rarity, r.n])),
    xp: u?.xp || 0, streak: u?.streak || 0, best_streak: u?.best_streak || 0, top: rank || 0,
  };
  s.level = level(s.xp);
  return s;
}
async function weeklyRank(env, userId) {
  const since = Date.now() - 7 * 86400e3;
  const mine = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) s FROM xp_log WHERE user_id = ? AND at > ?").bind(userId, since).first("s");
  if (!mine) return 0;
  const above = await env.DB.prepare("SELECT COUNT(*) n FROM (SELECT user_id, SUM(amount) s FROM xp_log WHERE at > ? GROUP BY user_id) WHERE s > ?").bind(since, mine).first("n");
  return (above || 0) + 1;
}
const isOwnerId = (env, id) => String(id) === String(env.OWNER_ID || "");
const isAdmin = u => u?.role === "admin" || u?.role === "owner";
const publicUser = u => u && ({
  id: u.id, nick: u.nick || u.first_name || "Без имени", avatar: u.avatar || "🦊", color: u.color || "sun",
  username: u.username || "", tgPhoto: u.tg_photo || "", verified: !!u.verified, role: u.role || "", banned: !!u.banned, skin: u.skin || "",
  status: u.status || "🌱", bio: u.bio || "", banner: u.banner || "", xp: u.xp || 0, level: level(u.xp || 0), streak: u.streak || 0, onboarded: !!u.nick,
});

/* ---------------- quests ---------------- */
async function questState(env, userId) {
  const q = questOf(dayKey());
  const start = Date.parse(q.day + "T00:00:00+03:00");
  const progress = q.kind === "create"
    ? await env.DB.prepare("SELECT COUNT(*) n FROM marks WHERE owner = ? AND cat = ? AND created_at >= ?").bind(userId, q.cat, start).first("n")
    : await env.DB.prepare("SELECT COUNT(*) n FROM collects WHERE user_id = ? AND at >= ?").bind(userId, start).first("n");
  const claimed = await env.DB.prepare("SELECT 1 x FROM quest_claims WHERE user_id = ? AND day = ?").bind(userId, q.day).first("x");
  return { ...q, progress: Math.min(progress || 0, q.n), done: !!claimed };
}
async function maybeClaimQuest(env, userId) {
  const q = await questState(env, userId);
  if (q.done || q.progress < q.n) return 0;
  const r = await env.DB.prepare("INSERT OR IGNORE INTO quest_claims (user_id, day) VALUES (?, ?)").bind(userId, q.day).run();
  if (r.meta?.changes) { await addXp(env, userId, q.xp, "quest"); await addCases(env, userId, 1, "rare"); return q.xp; }
  return 0;
}

/* ---------------- cases & items ---------------- */
async function ownedItems(env, userId) {
  const r = await env.DB.prepare("SELECT item FROM user_items WHERE user_id = ? ORDER BY at").bind(userId).all();
  return (r.results || []).map(x => x.item).filter(id => CASE_ITEM[id]);
}
const allStatuses = (s, items) => [...unlockedStatuses(s), ...items.map(id => CASE_ITEM[id]).filter(i => i.kind === "status").map(i => i.v)];
async function caseState(env, userId) {
  const [r, inv] = await Promise.all([
    env.DB.prepare("SELECT last_daily FROM user_cases WHERE user_id = ?").bind(userId).first(),
    env.DB.prepare("SELECT tier, count FROM case_inv WHERE user_id = ?").bind(userId).all(),
  ]);
  const tiers = Object.fromEntries(TIER_IDS.map(t => [t, 0]));
  for (const x of inv.results || []) if (CASE_TIERS[x.tier]) tiers[x.tier] = x.count;
  return { tiers, count: Object.values(tiers).reduce((a, b) => a + b, 0), dailyReady: r?.last_daily !== dayKey() };
}
async function findUser(env, to) {
  const v = String(to ?? "").trim().replace(/^@/, "");
  if (!v) return null;
  return /^\d+$/.test(v)
    ? env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(Number(v)).first()
    : env.DB.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").bind(v).first();
}
async function giveGift(env, userId, itemId, fromUser = null) {
  const serial = ((await env.DB.prepare("SELECT MAX(serial) s FROM gifts WHERE item = ?").bind(itemId).first("s")) || 0) + 1;
  const r = await env.DB.prepare("INSERT INTO gifts (item, serial, owner, from_user, at) VALUES (?, ?, ?, ?, ?)").bind(itemId, serial, userId, fromUser, Date.now()).run();
  return { id: r.meta?.last_row_id, item: itemId, serial };
}
async function giftsOf(env, userId, pinnedOnly = false) {
  const r = await env.DB.prepare(`SELECT g.*, u.nick AS from_nick, u.first_name AS from_first FROM gifts g LEFT JOIN users u ON u.id = g.from_user WHERE g.owner = ? ${pinnedOnly ? "AND g.pinned = 1" : ""} ORDER BY g.pinned DESC, g.at DESC LIMIT 200`).bind(userId).all();
  return (r.results || []).filter(g => CASE_ITEM[g.item]).map(g => ({ id: g.id, item: g.item, serial: g.serial, pinned: !!g.pinned, at: g.at, from: g.from_user ? (g.from_nick || g.from_first || "Кто-то") : null }));
}

/* ---------------- marks ---------------- */
const MARK_SELECT = `SELECT m.*, u.nick, u.first_name, u.avatar, u.color, u.status, u.xp AS owner_xp, u.verified AS owner_verified, u.tg_photo AS owner_photo, u.skin AS owner_skin,
  (SELECT COUNT(*) FROM reactions r WHERE r.code = m.code) AS reacts,
  (SELECT COUNT(*) FROM collects c WHERE c.code = m.code) AS collects
  FROM marks m JOIN users u ON u.id = m.owner AND COALESCE(u.banned, 0) = 0`;
const shapeMark = (r, origin) => ({
  code: r.code, name: r.name, emoji: r.emoji, cat: r.cat, story: r.story || "", place: r.place || "",
  lat: r.lat, lon: r.lon, rarity: r.rarity, num: r.num, at: r.created_at,
  pattern: parseJson(r.pattern), seen: parseJson(r.seen),
  photo: r.photo_id ? `${origin}/img/${r.photo_id}` : null,
  reacts: r.reacts || 0, collects: r.collects || 0,
  owner: { id: r.owner, nick: r.nick || r.first_name || "Без имени", avatar: r.avatar || "🦊", color: r.color || "sun", status: r.status || "🌱", level: level(r.owner_xp || 0), verified: !!r.owner_verified, tgPhoto: r.owner_photo || "", skin: r.owner_skin || "" },
});

async function createMark(req, env, me, origin, ctx) {
  const form = await req.formData();
  const name = clean(form.get("name"), 40);
  const cat = String(form.get("cat") || "");
  const emoji = clean(form.get("emoji"), 16) || "📍";
  if (!name) return json({ error: "name_required" }, 400);
  if (!CAT_IDS.has(cat)) return json({ error: "bad_category" }, 400);
  let lat = num(form.get("lat")), lon = num(form.get("lon"));
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) lat = lon = null;

  // Rate limit: 40 marks per day per person.
  const today = Date.parse(dayKey() + "T00:00:00+03:00");
  const todayCount = await env.DB.prepare("SELECT COUNT(*) n FROM marks WHERE owner = ? AND created_at >= ?").bind(me.id, today).first("n");
  if (todayCount >= 40) return json({ error: "daily_limit" }, 429);

  let photoId = null, subject = null;
  const photo = form.get("photo");
  if (photo && typeof photo === "object" && photo.size) {
    if (photo.size > MAX_PHOTO) return json({ error: "photo_too_large" }, 413);
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(photo.type) ? photo.type : "image/jpeg";
    const buf = await photo.arrayBuffer();
    photoId = randId(16, "abcdefghijklmnopqrstuvwxyz0123456789");
    await env.DB.prepare("INSERT INTO photos (id, mime, data, created_at) VALUES (?, ?, ?, ?)")
      .bind(photoId, mime, buf, Date.now()).run();
    // What is in the photo? Cloudflare Workers AI image classifier (free tier). Optional: works without it.
    if (env.AI) {
      try { subject = detectSubject(await env.AI.run("@cf/microsoft/resnet-50", { image: [...new Uint8Array(buf)] })); } catch (e) { console.error("ai", e); }
    }
  }

  const tone = /^#[0-9a-f]{6}$/i.test(String(form.get("tone") || "")) ? String(form.get("tone")) : null;
  const rarity = rollRarity(Math.random(), subject ? subject.s : .2);
  const pattern = makePattern(rarity, subject?.e || emoji, tone);
  const seen = subject ? JSON.stringify({ e: subject.e, ru: subject.ru, conf: subject.conf }) : null;
  let code;
  for (let i = 0; i < 6; i++) {
    code = randId(5);
    try {
      await env.DB.prepare(
        `INSERT INTO marks (code, owner, name, emoji, cat, story, place, lat, lon, photo_id, rarity, num, created_at, pattern, seen)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, (SELECT COALESCE(MAX(num), 0) + 1 FROM marks), ?12, ?13, ?14)`
      ).bind(code, me.id, name, emoji, cat, clean(form.get("story"), 220), clean(form.get("place"), 60), lat, lon, photoId, rarity, Date.now(), JSON.stringify(pattern), seen).run();
      break;
    } catch (e) { if (!String(e).includes("UNIQUE") || i === 5) throw e; }
  }
  const xp = RARITY[rarity].xp + (photoId ? 5 : 0) + (lat !== null ? 5 : 0);
  const levelUps = await addXp(env, me.id, xp, "create");
  if (rarity === "legend" || rarity === "epic") ctx.waitUntil((async () => {
    await sticker(env, me.id, rarity === "legend" ? "😱" : "😍", "🎉");
    await tg(env, "sendMessage", { chat_id: me.id, text: `${rarity === "legend" ? "👑 ЛЕГЕНДА!" : "💎 Эпическая метка!"} «${emoji} ${name}» теперь твоя навсегда.`, reply_markup: { inline_keyboard: [[{ text: "Открыть метку", url: appLink(env, "m_" + code) }]] } });
  })().catch(() => {}));
  await touchStreak(env, me);
  const questXp = await maybeClaimQuest(env, me.id);
  const row = await env.DB.prepare(`${MARK_SELECT} WHERE m.code = ?`).bind(code).first();
  return json({ mark: shapeMark(row, origin), xp, questXp, levelUps });
}

async function markDetail(env, me, code, origin) {
  const row = await env.DB.prepare(`${MARK_SELECT} WHERE m.code = ?`).bind(code).first();
  if (!row) return json({ error: "not_found" }, 404);
  const [rx, mine, col, collectors] = await Promise.all([
    env.DB.prepare("SELECT emoji, COUNT(*) n FROM reactions WHERE code = ? GROUP BY emoji").bind(code).all(),
    env.DB.prepare("SELECT emoji FROM reactions WHERE code = ? AND user_id = ?").bind(code, me.id).first("emoji"),
    env.DB.prepare("SELECT 1 x FROM collects WHERE code = ? AND user_id = ?").bind(code, me.id).first("x"),
    env.DB.prepare("SELECT u.id, u.nick, u.first_name, u.avatar, u.color FROM collects c JOIN users u ON u.id = c.user_id WHERE c.code = ? ORDER BY c.at DESC LIMIT 8").bind(code).all(),
  ]);
  return json({
    mark: shapeMark(row, origin),
    reactions: Object.fromEntries((rx.results || []).map(r => [r.emoji, r.n])),
    myReaction: mine || null, collected: !!col, mine: row.owner === me.id,
    collectors: (collectors.results || []).map(u => ({ id: u.id, nick: u.nick || u.first_name, avatar: u.avatar || "🦊", color: u.color || "sun" })),
  });
}

async function collect(req, env, me, code, ctx) {
  const body = await req.json().catch(() => ({}));
  const m = await env.DB.prepare("SELECT * FROM marks WHERE code = ?").bind(code).first();
  if (!m) return json({ error: "not_found" }, 404);
  if (m.owner === me.id) return json({ error: "own_mark" }, 400);
  if (m.lat !== null && m.lon !== null) {
    const lat = num(body.lat), lon = num(body.lon);
    if (lat === null || lon === null) return json({ error: "need_location" }, 400);
    const d = distM({ lat, lon }, { lat: m.lat, lon: m.lon });
    if (d > COLLECT_RADIUS_M) return json({ error: "too_far", dist: Math.round(d) }, 400);
  }
  const r = await env.DB.prepare("INSERT OR IGNORE INTO collects (user_id, code, at) VALUES (?, ?, ?)").bind(me.id, code, Date.now()).run();
  if (!r.meta?.changes) return json({ error: "already" }, 409);
  const xp = RARITY[m.rarity]?.collectXp || 5;
  await addXp(env, me.id, xp, "collect");
  await addXp(env, m.owner, 3, "collected_by_other");
  await touchStreak(env, me);
  const questXp = await maybeClaimQuest(env, me.id);
  const who = me.nick || me.first_name || "Кто-то";
  ctx.waitUntil(sticker(env, m.owner, "🎉", "🥳").then(() => tg(env, "sendMessage", {
    chat_id: m.owner,
    text: `${me.avatar || "🦊"} ${who} нашёл твою метку «${m.emoji} ${m.name}»! +3 XP`,
    reply_markup: { inline_keyboard: [[{ text: "Открыть метку", url: appLink(env, "m_" + code) }]] },
  })).catch(() => {}));
  return json({ ok: true, xp, questXp });
}

async function react(req, env, me, code) {
  const { emoji } = await req.json().catch(() => ({}));
  if (!REACTIONS.includes(emoji)) return json({ error: "bad_reaction" }, 400);
  const exists = await env.DB.prepare("SELECT code FROM marks WHERE code = ?").bind(code).first("code");
  if (!exists) return json({ error: "not_found" }, 404);
  const cur = await env.DB.prepare("SELECT emoji FROM reactions WHERE code = ? AND user_id = ?").bind(code, me.id).first("emoji");
  if (cur === emoji) await env.DB.prepare("DELETE FROM reactions WHERE code = ? AND user_id = ?").bind(code, me.id).run();
  else await env.DB.prepare("INSERT INTO reactions (user_id, code, emoji, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, code) DO UPDATE SET emoji = excluded.emoji, at = excluded.at").bind(me.id, code, emoji, Date.now()).run();
  const rx = await env.DB.prepare("SELECT emoji, COUNT(*) n FROM reactions WHERE code = ? GROUP BY emoji").bind(code).all();
  return json({ reactions: Object.fromEntries((rx.results || []).map(r => [r.emoji, r.n])), myReaction: cur === emoji ? null : emoji });
}

/* ---------------- API router ---------------- */
async function api(req, url, env, ctx) {
  const tgUser = await verifyInitData(req.headers.get("x-init-data"), env.BOT_TOKEN);
  if (!tgUser?.id) return json({ error: "unauthorized" }, 401);
  const me = await upsertUser(env, tgUser);
  const origin = url.origin;
  const p = url.pathname.replace(/\/+$/, "");
  const seg = p.split("/").slice(2); // after /api
  const M = req.method;
  if (me.banned && p !== "/api/me") return json({ error: "banned" }, 403);
  if (seg[0] === "admin") return adminApi(req, env, me, seg, M, url, origin);

  if (p === "/api/me" && M === "GET") {
    const s = await stats(env, me.id);
    const items = await ownedItems(env, me.id);
    return json({ user: publicUser(me), stats: s, statuses: allStatuses(s, items), items, cases: await caseState(env, me.id), quest: await questState(env, me.id) });
  }
  if (p === "/api/me" && M === "POST") {
    const b = await req.json().catch(() => ({}));
    const s = await stats(env, me.id);
    const nick = clean(b.nick, 24) || me.nick || clean(me.first_name, 24) || "Исследователь";
    const items = await ownedItems(env, me.id);
    const ownedVals = kind => items.map(id => CASE_ITEM[id]).filter(i => i?.kind === kind).map(i => i.v);
    const avatar = AVATARS.includes(b.avatar) || ownedVals("avatar").includes(b.avatar) || (b.avatar === "tg" && me.tg_photo) ? b.avatar : (me.avatar || "🦊");
    const banner = b.banner === "" || ownedVals("banner").includes(b.banner) ? (b.banner || null) : (me.banner || null);
    const skin = b.skin === "" || ownedVals("skin").includes(b.skin) ? (b.skin || null) : (me.skin || null);
    const color = COLORS.some(c => c.id === b.color) ? b.color : (me.color || "sun");
    const status = allStatuses(s, items).includes(b.status) ? b.status : (me.status || "🌱");
    await env.DB.prepare("UPDATE users SET nick = ?, avatar = ?, color = ?, status = ?, bio = ?, banner = ?, skin = ? WHERE id = ?")
      .bind(nick, avatar, color, status, clean(b.bio, 120), banner, skin, me.id).run();
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first();
    return json({ user: publicUser(u) });
  }
  if (p === "/api/cases/daily" && M === "POST") {
    const today = dayKey();
    const r = await env.DB.prepare("INSERT INTO user_cases (user_id, count, last_daily) VALUES (?1, 0, ?2) ON CONFLICT(user_id) DO UPDATE SET last_daily = ?2 WHERE last_daily IS NULL OR last_daily != ?2").bind(me.id, today).run();
    if (!r.meta?.changes) return json({ error: "already_claimed" }, 409);
    await addCases(env, me.id, 1, "common");
    return json({ cases: await caseState(env, me.id) });
  }
  if (p === "/api/cases/send" && M === "POST") {
    const b = await req.json().catch(() => ({}));
    const tier = CASE_TIERS[b.tier] ? b.tier : "common";
    const to = await findUser(env, b.to);
    if (!to || to.banned) return json({ error: "user_not_found" }, 404);
    if (to.id === me.id) return json({ error: "self" }, 400);
    const r = await env.DB.prepare("UPDATE case_inv SET count = count - 1 WHERE user_id = ? AND tier = ? AND count > 0").bind(me.id, tier).run();
    if (!r.meta?.changes) return json({ error: "no_cases" }, 400);
    await addCases(env, to.id, 1, tier);
    ctx.waitUntil(sticker(env, to.id, "🎁", "🎉").then(() => tg(env, "sendMessage", { chat_id: to.id, text: `🎁 ${me.nick || me.first_name} подарил(а) тебе ${CASE_TIERS[tier].t.toLowerCase()}!`, reply_markup: { inline_keyboard: [[{ text: "Открыть кейс", web_app: { url: env.WEBAPP_URL + "?tab=cases" } }]] } })).catch(() => {}));
    return json({ cases: await caseState(env, me.id), to: publicUser(to) });
  }
  if (p === "/api/cases/open" && M === "POST") {
    const b = await req.json().catch(() => ({}));
    const tier = CASE_TIERS[b.tier] ? b.tier : "common";
    const r = await env.DB.prepare("UPDATE case_inv SET count = count - 1 WHERE user_id = ? AND tier = ? AND count > 0").bind(me.id, tier).run();
    if (!r.meta?.changes) return json({ error: "no_cases" }, 400);
    const prize = rollCaseItem(Math.random, tier);
    let xp = 0, owned = false, gift = null;
    if (prize.kind === "xp") xp = prize.v;
    else if (prize.kind === "gift") gift = await giveGift(env, me.id, prize.id);
    else {
      owned = !!(await env.DB.prepare("SELECT 1 x FROM user_items WHERE user_id = ? AND item = ?").bind(me.id, prize.id).first("x"));
      if (owned) xp = DUP_XP[prize.r];
      else await env.DB.prepare("INSERT OR IGNORE INTO user_items (user_id, item, at) VALUES (?, ?, ?)").bind(me.id, prize.id, Date.now()).run();
    }
    const levelUps = await addXp(env, me.id, xp, "case");
    if (prize.r === "legend" || prize.r === "epic") ctx.waitUntil((async () => {
      await sticker(env, me.id, prize.r === "legend" ? "🥳" : "🤩", "🎉");
      await tg(env, "sendMessage", { chat_id: me.id, text: `${prize.e} Из кейса выпало: ${prize.t}! ${prize.r === "legend" ? "Это ЛЕГЕНДА 👑" : "Эпическая награда 💎"}` });
    })().catch(() => {}));
    return json({ prize: prize.id, gift, strip: caseStrip(prize, Math.random, tier), win: STRIP_WIN, duplicate: owned, xp, levelUps, cases: await caseState(env, me.id) });
  }
  if (p === "/api/gifts" && M === "GET") return json({ gifts: await giftsOf(env, me.id) });
  if (seg[0] === "gifts" && seg[1] && M === "POST") {
    const g = await env.DB.prepare("SELECT * FROM gifts WHERE id = ?").bind(Number(seg[1])).first();
    if (!g || g.owner !== me.id) return json({ error: "not_found" }, 404);
    const b = await req.json().catch(() => ({}));
    if (seg[2] === "pin") {
      await env.DB.prepare("UPDATE gifts SET pinned = ? WHERE id = ?").bind(b.pinned ? 1 : 0, g.id).run();
      return json({ gifts: await giftsOf(env, me.id) });
    }
    if (seg[2] === "send") {
      const to = await findUser(env, b.to);
      if (!to || to.banned) return json({ error: "user_not_found" }, 404);
      if (to.id === me.id) return json({ error: "self" }, 400);
      await env.DB.prepare("UPDATE gifts SET owner = ?, from_user = ?, pinned = 0, at = ? WHERE id = ? AND owner = ?").bind(to.id, me.id, Date.now(), g.id, me.id).run();
      const it = CASE_ITEM[g.item];
      ctx.waitUntil(sticker(env, to.id, "🎁", "😍").then(() => tg(env, "sendMessage", { chat_id: to.id, text: `🎁 ${me.nick || me.first_name} подарил(а) тебе «${it.e} ${it.t} #${g.serial}»! Теперь это место твоё.`, reply_markup: { inline_keyboard: [[{ text: "Посмотреть", web_app: { url: env.WEBAPP_URL + "?tab=cases" } }]] } })).catch(() => {}));
      return json({ gifts: await giftsOf(env, me.id), to: publicUser(to) });
    }
  }
  if (p === "/api/users/find" && M === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().replace(/^@/, "");
    if (q.length < 2) return json({ users: [] });
    const r = await env.DB.prepare("SELECT * FROM users WHERE COALESCE(banned,0) = 0 AND id != ? AND (nick LIKE ?2 OR username LIKE ?2 OR first_name LIKE ?2 OR CAST(id AS TEXT) = ?3) LIMIT 8").bind(me.id, `%${q}%`, q).all();
    return json({ users: (r.results || []).map(publicUser) });
  }
  if (p === "/api/feed" && M === "GET") {
    const sort = url.searchParams.get("sort") || "new";
    const cat = url.searchParams.get("cat");
    const lat = num(url.searchParams.get("lat")), lon = num(url.searchParams.get("lon"));
    const where = [], args = [];
    if (cat && CAT_IDS.has(cat)) { where.push("m.cat = ?"); args.push(cat); }
    if (sort === "near" && lat !== null && lon !== null) { where.push("m.lat BETWEEN ? AND ? AND m.lon BETWEEN ? AND ?"); args.push(lat - .2, lat + .2, lon - .3, lon + .3); }
    const order = sort === "top" ? "reacts DESC, m.created_at DESC" : "m.created_at DESC";
    const rows = await env.DB.prepare(`${MARK_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT 300`).bind(...args).all();
    let marks = (rows.results || []).map(r => shapeMark(r, origin));
    if (sort === "near" && lat !== null) marks = marks.map(m => ({ ...m, dist: Math.round(distM({ lat, lon }, m)) })).sort((a, b) => a.dist - b.dist);
    return json({ marks: marks.slice(0, 120) });
  }
  if (p === "/api/map" && M === "GET") {
    const rows = await env.DB.prepare(`${MARK_SELECT} WHERE m.lat IS NOT NULL ORDER BY m.created_at DESC LIMIT 1000`).all();
    return json({ marks: (rows.results || []).map(r => shapeMark(r, origin)) });
  }
  if (p === "/api/marks" && M === "POST") return createMark(req, env, me, origin, ctx);
  if (seg[0] === "marks" && seg[1]) {
    const code = seg[1].toUpperCase();
    if (!seg[2] && M === "GET") return markDetail(env, me, code, origin);
    if (!seg[2] && M === "DELETE") {
      const m = await env.DB.prepare("SELECT owner, photo_id FROM marks WHERE code = ?").bind(code).first();
      if (!m) return json({ error: "not_found" }, 404);
      if (m.owner !== me.id && !isAdmin(me)) return json({ error: "forbidden" }, 403);
      if (m.owner !== me.id && me.role !== "owner" && isOwnerId(env, m.owner)) return json({ error: "owner_protected" }, 403);
      if (m.owner !== me.id) await logAdmin(env, me.id, "delete_mark", code);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM marks WHERE code = ?").bind(code),
        env.DB.prepare("DELETE FROM reactions WHERE code = ?").bind(code),
        env.DB.prepare("DELETE FROM collects WHERE code = ?").bind(code),
        env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(m.photo_id || ""),
      ]);
      return json({ ok: true });
    }
    if (seg[2] === "collect" && M === "POST") return collect(req, env, me, code, ctx);
    if (seg[2] === "react" && M === "POST") return react(req, env, me, code);
  }
  if (seg[0] === "users" && seg[1] && M === "GET") {
    const id = Number(seg[1]);
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!u) return json({ error: "not_found" }, 404);
    const [s, own, col] = await Promise.all([
      stats(env, id),
      env.DB.prepare(`${MARK_SELECT} WHERE m.owner = ? ORDER BY m.created_at DESC LIMIT 200`).bind(id).all(),
      env.DB.prepare(`${MARK_SELECT} JOIN collects c ON c.code = m.code WHERE c.user_id = ? ORDER BY c.at DESC LIMIT 200`).bind(id).all(),
    ]);
    const gifts = await giftsOf(env, id, id !== me.id);
    return json({ user: publicUser(u), stats: s, gifts, giftCount: id === me.id ? gifts.length : (await env.DB.prepare("SELECT COUNT(*) n FROM gifts WHERE owner = ?").bind(id).first("n")), marks: (own.results || []).map(r => shapeMark(r, origin)), collected: (col.results || []).map(r => shapeMark(r, origin)) });
  }
  if (p === "/api/top" && M === "GET") {
    const week = url.searchParams.get("period") !== "all";
    const rows = week
      ? await env.DB.prepare(`SELECT u.*, s.score FROM (SELECT user_id, SUM(amount) score FROM xp_log WHERE at > ? GROUP BY user_id) s JOIN users u ON u.id = s.user_id WHERE COALESCE(u.banned, 0) = 0 ORDER BY s.score DESC LIMIT 50`).bind(Date.now() - 7 * 86400e3).all()
      : await env.DB.prepare(`SELECT u.*, u.xp AS score FROM users u WHERE u.xp > 0 AND COALESCE(u.banned, 0) = 0 ORDER BY u.xp DESC LIMIT 50`).all();
    const list = (rows.results || []).map((u, i) => ({ ...publicUser(u), score: u.score, rank: i + 1 }));
    return json({ rows: list, me: week ? await weeklyRank(env, me.id) : null });
  }
  return json({ error: "not_found" }, 404);
}

/* ---------------- admin ---------------- */
async function logAdmin(env, adminId, action, target) {
  await env.DB.prepare("INSERT INTO admin_log (admin, action, target, at) VALUES (?, ?, ?, ?)").bind(adminId, action, String(target ?? ""), Date.now()).run();
}
// Owner: everything. Admin: ban/unban regular users, delete any mark, give or remove the blue check.
// Only the owner hands out or removes admin rights. Nobody can touch the owner.
async function adminApi(req, env, me, seg, M, url, origin) {
  if (!isAdmin(me)) return json({ error: "forbidden" }, 403);
  const owner = me.role === "owner";
  if (seg[1] === "stats" && M === "GET") {
    const day = Date.now() - 86400e3;
    const [users, marks, today, banned, admins, log] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM users").first("n"),
      env.DB.prepare("SELECT COUNT(*) n FROM marks").first("n"),
      env.DB.prepare("SELECT COUNT(*) n FROM marks WHERE created_at > ?").bind(day).first("n"),
      env.DB.prepare("SELECT COUNT(*) n FROM users WHERE banned = 1").first("n"),
      env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role IN ('admin','owner')").first("n"),
      env.DB.prepare("SELECT l.*, u.nick, u.first_name FROM admin_log l LEFT JOIN users u ON u.id = l.admin ORDER BY l.at DESC LIMIT 30").all(),
    ]);
    return json({ users, marks, today, banned, admins, log: (log.results || []).map(r => ({ admin: r.nick || r.first_name || r.admin, action: r.action, target: r.target, at: r.at })) });
  }
  if (seg[1] === "users" && !seg[2] && M === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().replace(/^@/, "");
    const filter = url.searchParams.get("filter") || "";
    const where = [], args = [];
    if (q) { where.push("(u.nick LIKE ? OR u.username LIKE ? OR u.first_name LIKE ? OR CAST(u.id AS TEXT) = ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`, q); }
    if (filter === "banned") where.push("u.banned = 1");
    if (filter === "admins") where.push("u.role IN ('admin','owner')");
    const rows = await env.DB.prepare(`SELECT u.*, (SELECT COUNT(*) FROM marks m WHERE m.owner = u.id) AS mark_count FROM users u ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY u.created_at DESC LIMIT 100`).bind(...args).all();
    return json({ users: (rows.results || []).map(u => ({ ...publicUser(u), marks: u.mark_count, created: u.created_at })) });
  }
  if (seg[1] === "users" && seg[2] && M === "POST") {
    const id = Number(seg[2]);
    const t = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!t) return json({ error: "not_found" }, 404);
    if (t.role === "owner" || isOwnerId(env, id)) return json({ error: "owner_protected" }, 403);
    const b = await req.json().catch(() => ({}));
    if (t.role === "admin" && !owner) return json({ error: "only_owner" }, 403);
    const sets = [];
    if (typeof b.banned === "boolean" && id !== me.id) { sets.push(["banned", b.banned ? 1 : 0]); await logAdmin(env, me.id, b.banned ? "ban" : "unban", id); }
    if (typeof b.verified === "boolean") { sets.push(["verified", b.verified ? 1 : 0]); await logAdmin(env, me.id, b.verified ? "verify" : "unverify", id); }
    if (typeof b.admin === "boolean") {
      if (!owner) return json({ error: "only_owner" }, 403);
      sets.push(["role", b.admin ? "admin" : null]); await logAdmin(env, me.id, b.admin ? "make_admin" : "remove_admin", id);
    }
    for (const [k, v] of sets) await env.DB.prepare(`UPDATE users SET ${k} = ? WHERE id = ?`).bind(v, id).run();
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (b.banned === true) await tg(env, "sendMessage", { chat_id: id, text: "⛔ Твой аккаунт в Метке заблокирован модератором." }).catch(() => {});
    if (b.admin === true) await tg(env, "sendMessage", { chat_id: id, text: "🛡 Тебе выдали права администратора Метки." }).catch(() => {});
    return json({ user: publicUser(u) });
  }
  if (seg[1] === "grant" && M === "POST") {
    if (!owner) return json({ error: "only_owner" }, 403);
    const b = await req.json().catch(() => ({}));
    const to = await findUser(env, b.to);
    if (!to) return json({ error: "user_not_found" }, 404);
    const n = Math.max(1, Math.min(100, Number(b.n) || 1));
    let label = "";
    if (b.kind === "case" && CASE_TIERS[b.tier]) { await addCases(env, to.id, n, b.tier); label = `${CASE_TIERS[b.tier].t} ×${n}`; }
    else if (b.kind === "item" && CASE_ITEM[b.item]) {
      const it = CASE_ITEM[b.item];
      if (it.kind === "gift") { const out = []; for (let i = 0; i < n; i++) out.push((await giveGift(env, to.id, it.id, me.id)).serial); label = `${it.e} ${it.t} #${out.join(", #")}`; }
      else if (it.kind === "xp") { await addXp(env, to.id, it.v * n, "admin"); label = `${it.v * n} XP`; }
      else { await env.DB.prepare("INSERT OR IGNORE INTO user_items (user_id, item, at) VALUES (?, ?, ?)").bind(to.id, it.id, Date.now()).run(); label = `${it.e} ${it.t}`; }
    } else if (b.kind === "xp") { const v = Math.max(1, Math.min(100000, Number(b.n) || 0)); await addXp(env, to.id, v, "admin"); label = `${v} XP`; }
    else return json({ error: "bad_grant" }, 400);
    await logAdmin(env, me.id, "grant", `${to.id}: ${label}`);
    await sticker(env, to.id, "🎁", "🎉");
    await tg(env, "sendMessage", { chat_id: to.id, text: `🎁 Подарок от администрации Метки: ${label}`, reply_markup: { inline_keyboard: [[{ text: "Открыть", web_app: { url: env.WEBAPP_URL + "?tab=cases" } }]] } }).catch(() => {});
    return json({ ok: true, label, to: publicUser(to) });
  }
  if (seg[1] === "marks" && M === "GET") {
    const rows = await env.DB.prepare(`SELECT m.*, u.nick, u.first_name, u.avatar, u.color, u.status, u.xp AS owner_xp, u.verified AS owner_verified, u.tg_photo AS owner_photo, u.skin AS owner_skin, 0 AS reacts, 0 AS collects FROM marks m JOIN users u ON u.id = m.owner ORDER BY m.created_at DESC LIMIT 100`).all();
    return json({ marks: (rows.results || []).map(r => shapeMark(r, origin)) });
  }
  return json({ error: "not_found" }, 404);
}

/* ---------------- images ---------------- */
async function image(id, env) {
  if (!/^[a-z0-9]{16}$/.test(id)) return new Response("not found", { status: 404 });
  const row = await env.DB.prepare("SELECT mime, data FROM photos WHERE id = ?").bind(id).first();
  if (!row) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" },
  });
}

/* ---------------- bot ---------------- */
async function onUpdate(req, env, ctx) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret(env)) return new Response("forbidden", { status: 403 });
  const upd = await req.json().catch(() => ({}));
  const msg = upd.message;
  if (msg?.text?.startsWith("/start")) {
    const payload = msg.text.split(" ")[1] || "";
    const code = payload.startsWith("m_") ? payload.slice(2).toUpperCase() : "";
    const url = env.WEBAPP_URL + (code ? `?m=${code}` : "");
    ctx.waitUntil(sticker(env, msg.chat.id, code ? "👀" : "👋", "🎉").then(() => tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      text: code
        ? "📍 Тебе прислали метку! Открой её, посмотри карточку и построй маршрут."
        : "📍 Метка — живая коллекция города.\n\nФоткай котов, птиц, деревья, муралы и странные штуки. Давай им имена, ставь метки на карте и собирай чужие находки на прогулках.\n\nРедкость выпадает случайно: шанс на легенду 1% 👑",
      reply_markup: { inline_keyboard: [[{ text: code ? "Открыть метку" : "Открыть Метку", web_app: { url } }]] },
    })));
  } else if (msg?.text === "/top") {
    ctx.waitUntil(tg(env, "sendMessage", { chat_id: msg.chat.id, text: "🏆 Топ недели — в приложении", reply_markup: { inline_keyboard: [[{ text: "Открыть топ", web_app: { url: env.WEBAPP_URL + "?tab=top" } }]] } }));
  } else if (msg?.text === "/case" || msg?.text === "/cases") {
    ctx.waitUntil(sticker(env, msg.chat.id, "🎁", "🎉").then(() => tg(env, "sendMessage", { chat_id: msg.chat.id, text: "🎁 Каждый день — бесплатный кейс. Ещё кейсы дают за новый уровень и задание дня.", reply_markup: { inline_keyboard: [[{ text: "Открыть кейсы", web_app: { url: env.WEBAPP_URL + "?tab=cases" } }]] } })));
  } else if (msg?.text === "/help") {
    ctx.waitUntil(tg(env, "sendMessage", { chat_id: msg.chat.id, text: "Как играть:\n1. Нажми «+» и сфоткай находку\n2. Дай имя и эмодзи — выпадет редкость\n3. Покажи QR другу или найди чужие метки на карте\n4. Подойди к чужой метке ближе 80 м и нажми «Собрать»\n\nЗа всё дают XP, уровни и эмодзи-статусы." }));
  }
  return new Response("ok");
}

async function setup(url, env) {
  // Safe to call by anyone: it only points the bot at this server and refreshes its menu.
  const results = {
    webhook: await tg(env, "setWebhook", { url: `${url.origin}/tg`, secret_token: await webhookSecret(env), allowed_updates: ["message"] }),
    commands: await tg(env, "setMyCommands", { commands: [
      { command: "start", description: "Открыть Метку" }, { command: "top", description: "Топ недели" }, { command: "case", description: "Кейсы" }, { command: "help", description: "Как играть" },
    ] }),
    menu: await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "Метка", web_app: { url: env.WEBAPP_URL } } }),
    description: await tg(env, "setMyDescription", { description: "📍 Живая коллекция города: ставь метки на котов, птиц, деревья и муралы, собирай чужие находки на прогулках, качай уровень и открывай эмодзи-статусы." }),
    short: await tg(env, "setMyShortDescription", { short_description: "Живая коллекция города 📍 Котики, муралы, редкие находки" }),
  };
  return json(results);
}
