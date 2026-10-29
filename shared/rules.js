// Game rules shared by the Mini App and the server. Keep in sync by importing, never copying.
export const CATS = [
  { id: "cat",   t: "Котик",    e: "🐈", em: ["🐈", "🐈‍⬛", "😺", "😼", "😻", "🦁", "🐾", "👑"] },
  { id: "bird",  t: "Птица",    e: "🐦", em: ["🐦", "🕊️", "🦜", "🦢", "🦆", "🐦‍⬛", "🪶", "🦉"] },
  { id: "tree",  t: "Дерево",   e: "🌳", em: ["🌳", "🌲", "🌴", "🌿", "🍂", "🌸", "🌵", "🍃"] },
  { id: "art",   t: "Арт",      e: "🎨", em: ["🎨", "🖼️", "🗿", "✍️", "🧱", "🎭", "🌀", "👁️"] },
  { id: "place", t: "Место",    e: "📍", em: ["📍", "🌅", "🌊", "⛰️", "🏛️", "🚪", "🪟", "⚓"] },
  { id: "odd",   t: "Странное", e: "👽", em: ["👽", "🛸", "🧿", "🔮", "🦴", "🕳️", "🪐", "🍄"] },
];

export const RARITY = {
  common: { t: "Обычная",   w: 68, xp: 10,  collectXp: 5 },
  rare:   { t: "Редкая",    w: 23, xp: 20,  collectXp: 15 },
  epic:   { t: "Эпическая", w: 8,  xp: 40,  collectXp: 30 },
  legend: { t: "Легенда",   w: 1,  xp: 100, collectXp: 60 },
};

export const AVATARS = ["🦊", "🐸", "🐙", "🦄", "🐼", "🦉", "🐝", "🦖", "🐳", "🦩", "🐢", "🦔", "🐧", "🦋", "🐨", "🐯", "🍄", "🌵", "👾", "🤖", "👻", "🧙", "🥷", "🧑‍🚀"];
export const COLORS = [
  { id: "sun",    t: "Солнце",   a: "#FFD43B", b: "#FF8A3D" },
  { id: "sea",    t: "Море",     a: "#2EC4B6", b: "#3A7BFF" },
  { id: "grape",  t: "Виноград", a: "#B57BFF", b: "#5B3BFF" },
  { id: "rose",   t: "Роза",     a: "#FF6B9A", b: "#FF3D5A" },
  { id: "pine",   t: "Сосна",    a: "#7BE495", b: "#1F9D6B" },
  { id: "night",  t: "Ночь",     a: "#6E7BFF", b: "#1B1F3A" },
  { id: "peach",  t: "Персик",   a: "#FFC6A0", b: "#FF7E6B" },
  { id: "ice",    t: "Лёд",      a: "#BDF3FF", b: "#5EB8FF" },
];

export const level = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const levelFloor = lv => 50 * (lv - 1) ** 2;
export const levelCeil = lv => 50 * lv ** 2;

// Stats object: { created, collected, likes, streak, best_streak, level, cats:{cat:n}, rar:{epic:n}, found_rar:{...}, top }
export const STATUSES = [
  { e: "🌱", t: "Новичок",      d: "Есть у всех",               ok: () => true },
  { e: "🐾", t: "Кошатник",     d: "Поставь 5 котиков",          ok: s => (s.cats.cat || 0) >= 5 },
  { e: "🪶", t: "Орнитолог",    d: "Поставь 5 птиц",             ok: s => (s.cats.bird || 0) >= 5 },
  { e: "🌳", t: "Лесник",       d: "Поставь 5 деревьев",         ok: s => (s.cats.tree || 0) >= 5 },
  { e: "🎨", t: "Галерист",     d: "Поставь 5 арт-объектов",     ok: s => (s.cats.art || 0) >= 5 },
  { e: "🛸", t: "Охотник за странным", d: "Поставь 3 странных",  ok: s => (s.cats.odd || 0) >= 3 },
  { e: "🧭", t: "Следопыт",     d: "Собери 10 чужих меток",      ok: s => s.collected >= 10 },
  { e: "🔥", t: "В огне",       d: "Серия 3 дня подряд",         ok: s => s.best_streak >= 3 },
  { e: "⚡", t: "Неудержимый",  d: "Серия 7 дней подряд",        ok: s => s.best_streak >= 7 },
  { e: "🦉", t: "Знаток города", d: "Достигни 5 уровня",         ok: s => s.level >= 5 },
  { e: "💎", t: "Везунчик",     d: "Поставь эпическую метку",    ok: s => (s.rar.epic || 0) + (s.rar.legend || 0) >= 1 },
  { e: "👑", t: "Легенда",      d: "Поставь легендарную метку",  ok: s => (s.rar.legend || 0) >= 1 },
  { e: "❤️", t: "Любимчик",     d: "Получи 25 реакций",          ok: s => s.likes >= 25 },
  { e: "🏆", t: "Чемпион",      d: "Войди в топ-10 недели",      ok: s => s.top > 0 && s.top <= 10 },
];
export const unlockedStatuses = s => STATUSES.filter(x => x.ok(s)).map(x => x.e);

export const ACHIEVEMENTS = [
  { i: "🌱", t: "Первая метка",  d: "Поставь 1 метку",            ok: s => s.created >= 1 },
  { i: "🔟", t: "Коллекционер",  d: "Поставь 10 меток",           ok: s => s.created >= 10 },
  { i: "💯", t: "Сотня",         d: "Поставь 100 меток",          ok: s => s.created >= 100 },
  { i: "🤝", t: "Первая находка", d: "Собери чужую метку",        ok: s => s.collected >= 1 },
  { i: "🌈", t: "Полный набор",  d: "Все 6 категорий",           ok: s => Object.keys(s.cats).length >= 6 },
  ...STATUSES.slice(1).map(x => ({ i: x.e, t: x.t, d: x.d, ok: x.ok })),
];

export const REACTIONS = ["❤️", "🔥", "😹", "🤯", "👑"];
export const COLLECT_RADIUS_M = 80;

// Quest of the day: same for everyone, rotates by calendar day (Moscow time).
export function questOf(dayKey) {
  let h = 0; for (const c of dayKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cat = CATS[h % CATS.length];
  const kinds = [
    { kind: "create", n: 1, t: `Поставь метку «${cat.t}»`, xp: 30 },
    { kind: "create", n: 2, t: `Поставь 2 метки «${cat.t}»`, xp: 50 },
    { kind: "collect", n: 1, t: "Собери чужую метку на прогулке", xp: 40 },
  ];
  return { cat: cat.id, ...kinds[(h >> 4) % kinds.length], day: dayKey };
}
export const dayKey = (ms = Date.now()) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

export function distM(a, b) {
  const R = 6371000, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function rollRarity(rand = Math.random()) {
  const r = rand * 100; let acc = 0;
  for (const [k, v] of Object.entries(RARITY)) { acc += v.w; if (r < acc) return k; }
  return "common";
}
