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
// boost 0..1 — how unusual the thing in the photo is. Rare subjects shift the odds toward epic and legend.
export function rollRarity(rand = Math.random(), boost = 0) {
  const b = Math.max(0, Math.min(1, boost));
  const w = { common: RARITY.common.w * (1 - .65 * b), rare: RARITY.rare.w * (1 + 1.2 * b), epic: RARITY.epic.w * (1 + 3 * b), legend: RARITY.legend.w * (1 + 7 * b) };
  const total = Object.values(w).reduce((a, x) => a + x, 0);
  let r = rand * total, acc = 0;
  for (const [k, v] of Object.entries(w)) { acc += v; if (r < acc) return k; }
  return "common";
}

export const seeded = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; };

/* ---------- what the camera saw ---------- */
// [pattern over image-classifier labels, emoji, Russian name, how unusual 0..1]
export const SUBJECTS = [
  [/tabby|tiger cat|persian cat|siamese|egyptian cat/i, "🐈", "кот", .12],
  [/lynx|cougar|leopard|snow leopard|jaguar|cheetah|^lion|tiger(?! cat)/i, "🐆", "большая кошка", .95],
  [/terrier|retriever|shepherd|hound|poodle|pug|husky|malamute|corgi|chihuahua|spaniel|collie|dalmatian|beagle|bulldog|dachshund|labrador|samoyed|pomeranian|chow|dog/i, "🐕", "пёс", .1],
  [/great grey owl|owl/i, "🦉", "сова", .9],
  [/bald eagle|kite|vulture|eagle/i, "🦅", "хищная птица", .85],
  [/peacock|flamingo|toucan|macaw|cockatoo|lorikeet|hummingbird|black swan|pelican|stork|spoonbill|crane|heron|bittern/i, "🦩", "редкая птица", .8],
  [/goose|drake|duck|albatross|oystercatcher|redshank|dowitcher|turnstone|king penguin/i, "🦆", "водоплавающая птица", .4],
  [/goldfinch|house finch|junco|bunting|robin|bulbul|jay|magpie|chickadee|ouzel|quail|partridge|hen|cock|jacamar|bird/i, "🐦", "птица", .3],
  [/monarch|admiral|ringlet|cabbage butterfly|sulphur butterfly|lycaenid|butterfly/i, "🦋", "бабочка", .55],
  [/ladybug|dragonfly|damselfly|bee|mantis|cricket|grasshopper|beetle|cicada/i, "🐞", "насекомое", .5],
  [/lizard|gecko|iguana|chameleon|agama|skink|anole|turtle|terrapin|tortoise|snake|boa|python|viper/i, "🦎", "рептилия", .7],
  [/hedgehog|porcupine|squirrel|fox|badger|weasel|mink|otter|hare|rabbit/i, "🦔", "дикий зверь", .75],
  [/jellyfish|starfish|crab|lobster|sea lion|seal|dolphin|whale|shark|eel|coral/i, "🦀", "морской житель", .65],
  [/agaric|mushroom|hen-of-the-woods|bolete|earthstar|gyromitra|stinkhorn/i, "🍄", "гриб", .6],
  [/daisy|lady's slipper|rose hip|rapeseed|acorn|buckeye|pot|flowerpot|vase/i, "🌼", "цветок", .25],
  [/model t|space shuttle|airship|parachute|cannon|steam locomotive|totem pole|submarine/i, "🛸", "невероятное", 1],
  [/castle|palace|monastery|mosque|church|bell cote|obelisk|triumphal arch|dome|stupa|beacon|lighthouse|fountain|planetarium/i, "🏛️", "архитектура", .5],
  [/mosaic|comic book|jigsaw|mask|totem|stained|fresco|window screen|chain mail/i, "🎨", "арт", .6],
  [/convertible|sports car|limousine|jeep|tram|streetcar|trolleybus|cab|minibus|moped|motor scooter|bicycle/i, "🚗", "транспорт", .35],
  [/seashore|sandbar|promontory|cliff|lakeside|alp|volcano|valley|geyser|coral reef/i, "🌊", "пейзаж", .3],
  [/mailbox|street sign|traffic light|parking meter|manhole|pay-phone|umbrella|bench/i, "🪧", "городская штука", .2],
];
export function detectSubject(labels = []) {
  for (const l of labels.slice(0, 3)) {
    const name = String(l.label || "");
    for (const [re, e, ru, s] of SUBJECTS) if (re.test(name)) return { e, ru, s, conf: Math.round((l.score || 0) * 100), raw: name };
  }
  return null;
}

/* ---------- card patterns ---------- */
export const PATTERNS = {
  confetti: { t: "Конфетти", d: "Эмодзи рассыпаны по карточке" },
  waves:    { t: "Волна",    d: "Цветные волны с эмодзи" },
  stars:    { t: "Созвездие", d: "Эмодзи светятся среди звёзд" },
};
const PALETTE = ["#FF8A3D", "#2EC4B6", "#4D8BFF", "#A66BFF", "#FF5C9A", "#5DBB63", "#FFD43B", "#FF5C6C"];
const RARE_TINT = { common: "#9AA4B8", rare: "#4D8BFF", epic: "#A66BFF", legend: "#FFB020" };
// Motif follows rarity (with a little luck), colour comes from the photo, emoji from what was seen.
export function makePattern(rarity, emoji, tone, rand = Math.random) {
  const base = { common: "confetti", rare: "waves", epic: "stars", legend: "stars" }[rarity] || "confetti";
  const order = ["confetti", "waves", "stars"];
  let m = base;
  if (rarity !== "legend" && rand() < .18) m = order[Math.min(2, order.indexOf(base) + 1)];
  const c1 = /^#[0-9a-f]{6}$/i.test(tone || "") ? tone : PALETTE[Math.floor(rand() * PALETTE.length)];
  return { m, e: emoji, c1, c2: RARE_TINT[rarity] || "#9AA4B8", holo: rarity === "legend" };
}

/* ---------- cases ---------- */
// Case tiers: the rarer the case, the better the odds.
export const CASE_TIERS = {
  common: { t: "Обычный кейс",      c: "#9AA4B8", odds: { common: 60, rare: 28, epic: 10, legend: 2 } },
  rare:   { t: "Редкий кейс",       c: "#4D8BFF", odds: { common: 30, rare: 45, epic: 20, legend: 5 } },
  epic:   { t: "Эпический кейс",    c: "#A66BFF", odds: { common: 8,  rare: 40, epic: 40, legend: 12 } },
  legend: { t: "Легендарный кейс",  c: "#FFB020", odds: { common: 0,  rare: 25, epic: 50, legend: 25 } },
};
export const TIER_IDS = Object.keys(CASE_TIERS);

// kind: xp | avatar | status | banner | skin | gift. Duplicates of owned cosmetics turn into XP; gifts are always new numbered copies.
export const CASE_ITEMS = [
  { id: "xp25",   kind: "xp",     v: 25,  r: "common", t: "+25 XP",            e: "✨" },
  { id: "xp60",   kind: "xp",     v: 60,  r: "rare",   t: "+60 XP",            e: "💫" },
  { id: "xp150",  kind: "xp",     v: 150, r: "epic",   t: "+150 XP",           e: "🌟" },
  { id: "av_wolf",    kind: "avatar", v: "🐺", r: "common", t: "Аватар «Волк»",     e: "🐺" },
  { id: "av_peacock", kind: "avatar", v: "🦚", r: "rare",   t: "Аватар «Павлин»",   e: "🦚" },
  { id: "av_jelly",   kind: "avatar", v: "🪼", r: "rare",   t: "Аватар «Медуза»",   e: "🪼" },
  { id: "av_shark",   kind: "avatar", v: "🦈", r: "rare",   t: "Аватар «Акула»",    e: "🦈" },
  { id: "av_dragon",  kind: "avatar", v: "🐉", r: "epic",   t: "Аватар «Дракон»",   e: "🐉" },
  { id: "av_eagle",   kind: "avatar", v: "🦅", r: "epic",   t: "Аватар «Орёл»",     e: "🦅" },
  { id: "av_fairy",   kind: "avatar", v: "🧚", r: "legend", t: "Аватар «Фея»",      e: "🧚" },
  { id: "st_clover",  kind: "status", v: "🍀", r: "rare",   t: "Статус «Клевер»",   e: "🍀" },
  { id: "st_rainbow", kind: "status", v: "🌈", r: "epic",   t: "Статус «Радуга»",   e: "🌈" },
  { id: "st_gem",     kind: "status", v: "💠", r: "legend", t: "Статус «Бриллиант»", e: "💠" },
  { id: "bn_neon",    kind: "banner", v: "neon",   r: "rare",   t: "Фон «Неон»",            e: "🌃" },
  { id: "bn_aurora",  kind: "banner", v: "aurora", r: "epic",   t: "Фон «Северное сияние»", e: "🌌" },
  { id: "bn_gold",    kind: "banner", v: "gold",   r: "legend", t: "Фон «Золото»",          e: "🏆" },
  // card skins: change how all your marks look for everyone
  { id: "sk_pixel",   kind: "skin", v: "pixel",  r: "common", t: "Скин «Пиксель»",    e: "👾" },
  { id: "sk_marble",  kind: "skin", v: "marble", r: "rare",   t: "Скин «Мрамор»",     e: "🪨" },
  { id: "sk_holo",    kind: "skin", v: "holo",   r: "epic",   t: "Скин «Голограмма»", e: "🪩" },
  { id: "sk_cosmos",  kind: "skin", v: "cosmos", r: "epic",   t: "Скин «Космос»",     e: "🪐" },
  { id: "sk_gold",    kind: "skin", v: "gold",   r: "legend", t: "Скин «Золотая рамка»", e: "👑" },
  // place gifts: unique numbered collectibles that belong to one person and can be given away
  { id: "g_shell",     kind: "gift", v: "shell",     r: "common", t: "Ракушка с пляжа",        e: "🐚", c: "#FFC6A0" },
  { id: "g_cheburek",  kind: "gift", v: "cheburek",  r: "common", t: "Чебурек с набережной",   e: "🥟", c: "#E9C97A" },
  { id: "g_magnolia",  kind: "gift", v: "magnolia",  r: "common", t: "Магнолия",               e: "🌸", c: "#FF9EC4" },
  { id: "g_embank",    kind: "gift", v: "embank",    r: "rare",   t: "Набережная Ялты",        e: "🌊", c: "#3A8CE6" },
  { id: "g_cable",     kind: "gift", v: "cable",     r: "rare",   t: "Канатная дорога",        e: "🚡", c: "#2EC4B6" },
  { id: "g_nikita",    kind: "gift", v: "nikita",    r: "rare",   t: "Никитский сад",          e: "🌺", c: "#5DBB63" },
  { id: "g_uchansu",   kind: "gift", v: "uchansu",   r: "rare",   t: "Водопад Учан-Су",        e: "💧", c: "#5EB8FF" },
  { id: "g_aipetri",   kind: "gift", v: "aipetri",   r: "epic",   t: "Гора Ай-Петри",          e: "⛰️", c: "#8E96A8" },
  { id: "g_livadia",   kind: "gift", v: "livadia",   r: "epic",   t: "Ливадийский дворец",     e: "🏛️", c: "#F2F4F8" },
  { id: "g_massandra", kind: "gift", v: "massandra", r: "epic",   t: "Массандровский дворец",  e: "🏯", c: "#C9A2FF" },
  { id: "g_nest",      kind: "gift", v: "nest",      r: "legend", t: "Ласточкино гнездо",      e: "🏰", c: "#FFB020" },
];
export const CASE_ITEM = Object.fromEntries(CASE_ITEMS.map(i => [i.id, i]));
export const GIFTS = CASE_ITEMS.filter(i => i.kind === "gift");
export function rollCaseItem(rand = Math.random, tier = "common") {
  const odds = (CASE_TIERS[tier] || CASE_TIERS.common).odds;
  const pool = CASE_ITEMS.map(i => [i, (odds[i.r] || 0) / CASE_ITEMS.filter(x => x.r === i.r).length]).filter(([, w]) => w > 0);
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [i, w] of pool) { if ((r -= w) < 0) return i; }
  return pool[0][0];
}
export const DUP_XP = { common: 15, rare: 40, epic: 90, legend: 250 };
// A strip of items for the roulette, with the prize at a fixed slot.
export const STRIP_LEN = 44, STRIP_WIN = 37;
export function caseStrip(prize, rand = Math.random, tier = "common") {
  return Array.from({ length: STRIP_LEN }, (_, i) => i === STRIP_WIN ? prize.id : rollCaseItem(rand, tier).id);
}
