# Метка — Telegram Mini App

Живая коллекция города: ставь метки на котов, птиц, деревья и муралы, собирай чужие находки рядом, качай уровень и открывай эмодзи-статусы.

```
webapp/   приложение внутри Telegram (одна страница, GitHub Pages)
worker/   сервер: бот + API + база (Cloudflare Workers + D1, бесплатно)
shared/   правила игры: редкости, уровни, статусы, задания
```

## Запуск (один раз, ~15 минут)

### 1. Бот в Telegram
1. Напиши [@BotFather](https://t.me/BotFather) → `/newbot` → имя `Метка` → юзернейм, например `metka_city_bot`.
2. Сохрани токен — он понадобится в шаге 3. Никому его не отправляй.
3. `/newapp` → выбери бота → короткое имя `app` → адрес приложения из шага 2 ниже.

### 2. Приложение (GitHub Pages)
```bash
cd webapp
python3 build.py https://metka-api.ladavladus.workers.dev Metkadetect_bot app && cp dist/index.html ../docs/
# GitHub Pages раздаёт папку docs/ → https://mabient.github.io/metka/
```

### 3. Сервер (Cloudflare)
1. Cloudflare → Storage & Databases → D1 → создать базу `metka`, вставить её ID в `worker/wrangler.toml`.
2. Workers & Pages → Create → Import a repository → `Mabient/metka`, корневая папка `worker`.
3. В настройках воркера добавить секрет `BOT_TOKEN` (токен из BotFather).
4. Открыть `https://metka-api.<поддомен>.workers.dev/setup` — бот подключится к серверу. Таблицы создаются сами.

## Демо-режим
Если открыть `webapp/dist/index.html` вне Telegram, приложение работает на демо-данных — удобно для проверки дизайна.
