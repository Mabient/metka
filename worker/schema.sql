CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,           -- Telegram user id
  username TEXT, first_name TEXT,
  nick TEXT, avatar TEXT, color TEXT, status TEXT, bio TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, last_day TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS marks (
  code TEXT PRIMARY KEY,
  owner INTEGER NOT NULL,
  name TEXT NOT NULL, emoji TEXT NOT NULL, cat TEXT NOT NULL,
  story TEXT, place TEXT, lat REAL, lon REAL, photo_id TEXT,
  rarity TEXT NOT NULL, num INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  pattern TEXT,                     -- JSON: motif, emoji, colours given by the system
  seen TEXT                         -- JSON: what the image classifier recognised
);
CREATE INDEX IF NOT EXISTS marks_owner ON marks(owner, created_at);
CREATE INDEX IF NOT EXISTS marks_time ON marks(created_at);
CREATE INDEX IF NOT EXISTS marks_geo ON marks(lat, lon);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS collects (user_id INTEGER NOT NULL, code TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, code));
CREATE INDEX IF NOT EXISTS collects_code ON collects(code);
CREATE TABLE IF NOT EXISTS reactions (user_id INTEGER NOT NULL, code TEXT NOT NULL, emoji TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, code));
CREATE INDEX IF NOT EXISTS reactions_code ON reactions(code);
CREATE TABLE IF NOT EXISTS xp_log (user_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS xp_log_at ON xp_log(at, user_id);
CREATE TABLE IF NOT EXISTS quest_claims (user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
