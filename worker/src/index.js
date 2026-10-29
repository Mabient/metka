// Метка — Telegram bot + API on Cloudflare Workers (D1 database).
import {
  CATS, RARITY, STATUSES, REACTIONS, COLLECT_RADIUS_M, AVATARS, COLORS,
  level, questOf, dayKey, distM, rollRarity, unlockedStatuses,
} from "../../shared/rules.js";

const CAT_IDS = new Set(CATS.map(c => c.id));
const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PHOTO = 1_600_000;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    try {
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
const appLink = (env, param) => `https://t.me/${env.BOT_USERNAME}/${env.APP_NAME}${param ? "?startapp=" + param : ""}`;

/* ---------------- users, xp, streaks ---------------- */
async function upsertUser(env, u) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users (id, username, first_name, created_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET username = ?2, first_name = ?3`
  ).bind(u.id, u.username || null, clean(u.first_name, 64), now).run();
  return env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
}
async function addXp(env, userId, amount, reason) {
  if (!amount) return;
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET xp = xp + ? WHERE id = ?").bind(amount, userId),
    env.DB.prepare("INSERT INTO xp_log (user_id, amount, reason, at) VALUES (?, ?, ?, ?)").bind(userId, amount, reason, Date.now()),
  ]);
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
const publicUser = u => u && ({
  id: u.id, nick: u.nick || u.first_name || "Без имени", avatar: u.avatar || "🦊", color: u.color || "sun",
  status: u.status || "🌱", bio: u.bio || "", xp: u.xp || 0, level: level(u.xp || 0), streak: u.streak || 0, onboarded: !!u.nick,
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
  if (r.meta?.changes) { await addXp(env, userId, q.xp, "quest"); return q.xp; }
  return 0;
}

/* ---------------- marks ---------------- */
const MARK_SELECT = `SELECT m.*, u.nick, u.first_name, u.avatar, u.color, u.status, u.xp AS owner_xp,
  (SELECT COUNT(*) FROM reactions r WHERE r.code = m.code) AS reacts,
  (SELECT COUNT(*) FROM collects c WHERE c.code = m.code) AS collects
  FROM marks m JOIN users u ON u.id = m.owner`;
const shapeMark = (r, origin) => ({
  code: r.code, name: r.name, emoji: r.emoji, cat: r.cat, story: r.story || "", place: r.place || "",
  lat: r.lat, lon: r.lon, rarity: r.rarity, num: r.num, at: r.created_at,
  photo: r.photo_id ? `${origin}/img/${r.photo_id}` : null,
  reacts: r.reacts || 0, collects: r.collects || 0,
  owner: { id: r.owner, nick: r.nick || r.first_name || "Без имени", avatar: r.avatar || "🦊", color: r.color || "sun", status: r.status || "🌱", level: level(r.owner_xp || 0) },
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

  let photoId = null;
  const photo = form.get("photo");
  if (photo && typeof photo === "object" && photo.size) {
    if (photo.size > MAX_PHOTO) return json({ error: "photo_too_large" }, 413);
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(photo.type) ? photo.type : "image/jpeg";
    photoId = randId(16, "abcdefghijklmnopqrstuvwxyz0123456789");
    await env.DB.prepare("INSERT INTO photos (id, mime, data, created_at) VALUES (?, ?, ?, ?)")
      .bind(photoId, mime, await photo.arrayBuffer(), Date.now()).run();
  }

  const rarity = rollRarity();
  let code;
  for (let i = 0; i < 6; i++) {
    code = randId(5);
    try {
      await env.DB.prepare(
        `INSERT INTO marks (code, owner, name, emoji, cat, story, place, lat, lon, photo_id, rarity, num, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, (SELECT COALESCE(MAX(num), 0) + 1 FROM marks), ?12)`
      ).bind(code, me.id, name, emoji, cat, clean(form.get("story"), 220), clean(form.get("place"), 60), lat, lon, photoId, rarity, Date.now()).run();
      break;
    } catch (e) { if (!String(e).includes("UNIQUE") || i === 5) throw e; }
  }
  const xp = RARITY[rarity].xp + (photoId ? 5 : 0) + (lat !== null ? 5 : 0);
  await addXp(env, me.id, xp, "create");
  await touchStreak(env, me);
  const questXp = await maybeClaimQuest(env, me.id);
  const row = await env.DB.prepare(`${MARK_SELECT} WHERE m.code = ?`).bind(code).first();
  return json({ mark: shapeMark(row, origin), xp, questXp });
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
  ctx.waitUntil(tg(env, "sendMessage", {
    chat_id: m.owner,
    text: `${me.avatar || "🦊"} ${who} нашёл твою метку «${m.emoji} ${m.name}»! +3 XP`,
    reply_markup: { inline_keyboard: [[{ text: "Открыть метку", url: appLink(env, "m_" + code) }]] },
  }).catch(() => {}));
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

  if (p === "/api/me" && M === "GET") {
    const s = await stats(env, me.id);
    return json({ user: publicUser(me), stats: s, statuses: unlockedStatuses(s), quest: await questState(env, me.id) });
  }
  if (p === "/api/me" && M === "POST") {
    const b = await req.json().catch(() => ({}));
    const s = await stats(env, me.id);
    const nick = clean(b.nick, 24) || me.nick || clean(me.first_name, 24) || "Исследователь";
    const avatar = AVATARS.includes(b.avatar) ? b.avatar : (me.avatar || "🦊");
    const color = COLORS.some(c => c.id === b.color) ? b.color : (me.color || "sun");
    const status = unlockedStatuses(s).includes(b.status) ? b.status : (me.status || "🌱");
    await env.DB.prepare("UPDATE users SET nick = ?, avatar = ?, color = ?, status = ?, bio = ? WHERE id = ?")
      .bind(nick, avatar, color, status, clean(b.bio, 120), me.id).run();
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first();
    return json({ user: publicUser(u) });
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
      if (m.owner !== me.id) return json({ error: "forbidden" }, 403);
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
    return json({ user: publicUser(u), stats: s, marks: (own.results || []).map(r => shapeMark(r, origin)), collected: (col.results || []).map(r => shapeMark(r, origin)) });
  }
  if (p === "/api/top" && M === "GET") {
    const week = url.searchParams.get("period") !== "all";
    const rows = week
      ? await env.DB.prepare(`SELECT u.*, s.score FROM (SELECT user_id, SUM(amount) score FROM xp_log WHERE at > ? GROUP BY user_id) s JOIN users u ON u.id = s.user_id ORDER BY s.score DESC LIMIT 50`).bind(Date.now() - 7 * 86400e3).all()
      : await env.DB.prepare(`SELECT u.*, u.xp AS score FROM users u WHERE u.xp > 0 ORDER BY u.xp DESC LIMIT 50`).all();
    const list = (rows.results || []).map((u, i) => ({ ...publicUser(u), score: u.score, rank: i + 1 }));
    return json({ rows: list, me: week ? await weeklyRank(env, me.id) : null });
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
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  const upd = await req.json().catch(() => ({}));
  const msg = upd.message;
  if (msg?.text?.startsWith("/start")) {
    const payload = msg.text.split(" ")[1] || "";
    const code = payload.startsWith("m_") ? payload.slice(2).toUpperCase() : "";
    const url = env.WEBAPP_URL + (code ? `?m=${code}` : "");
    ctx.waitUntil(tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      text: code
        ? "📍 Тебе прислали метку! Открой её, посмотри карточку и построй маршрут."
        : "📍 Метка — живая коллекция города.\n\nФоткай котов, птиц, деревья, муралы и странные штуки. Давай им имена, ставь метки на карте и собирай чужие находки на прогулках.\n\nРедкость выпадает случайно: шанс на легенду 1% 👑",
      reply_markup: { inline_keyboard: [[{ text: code ? "Открыть метку" : "Открыть Метку", web_app: { url } }]] },
    }));
  } else if (msg?.text === "/top") {
    ctx.waitUntil(tg(env, "sendMessage", { chat_id: msg.chat.id, text: "🏆 Топ недели — в приложении", reply_markup: { inline_keyboard: [[{ text: "Открыть топ", web_app: { url: env.WEBAPP_URL + "?tab=top" } }]] } }));
  } else if (msg?.text === "/help") {
    ctx.waitUntil(tg(env, "sendMessage", { chat_id: msg.chat.id, text: "Как играть:\n1. Нажми «+» и сфоткай находку\n2. Дай имя и эмодзи — выпадет редкость\n3. Покажи QR другу или найди чужие метки на карте\n4. Подойди к чужой метке ближе 80 м и нажми «Собрать»\n\nЗа всё дают XP, уровни и эмодзи-статусы." }));
  }
  return new Response("ok");
}

async function setup(url, env) {
  if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) return new Response("forbidden", { status: 403 });
  const results = {
    webhook: await tg(env, "setWebhook", { url: `${url.origin}/tg`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message"] }),
    commands: await tg(env, "setMyCommands", { commands: [
      { command: "start", description: "Открыть Метку" }, { command: "top", description: "Топ недели" }, { command: "help", description: "Как играть" },
    ] }),
    menu: await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "Метка", web_app: { url: env.WEBAPP_URL } } }),
    description: await tg(env, "setMyDescription", { description: "📍 Живая коллекция города: ставь метки на котов, птиц, деревья и муралы, собирай чужие находки на прогулках, качай уровень и открывай эмодзи-статусы." }),
    short: await tg(env, "setMyShortDescription", { short_description: "Живая коллекция города 📍 Котики, муралы, редкие находки" }),
  };
  return json(results);
}
