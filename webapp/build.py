"""Builds the Mini App into dist/index.html (GitHub Pages) and dist/preview.html (artifact preview).
Usage: python3 build.py [API_URL] [BOT_USERNAME] [APP_NAME]"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
src = ROOT / "src"
rules = (ROOT.parent / "shared" / "rules.js").read_text(encoding="utf-8")
rules = re.sub(r"^export\s+", "", rules, flags=re.M)
qr = (src / "qr.js").read_text(encoding="utf-8").replace('if (typeof module !== "undefined") module.exports = QR;', "")
app = (src / "voxel.js").read_text(encoding="utf-8") + "\n" + (src / "app.js").read_text(encoding="utf-8")
args = sys.argv[1:] + [None] * 3
for key, val in zip(["@@API_URL@@", "@@BOT_USERNAME@@", "@@APP_NAME@@"], args[:3]):
    if val:
        app = app.replace(key, val)
css = (src / "styles.css").read_text(encoding="utf-8")
body = (src / "body.html").read_text(encoding="utf-8")
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=Onest:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">'
script = f"<script>\n{qr}\n{rules}\n{app}\n</script>"

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Метка</title>
<meta name="description" content="Живая коллекция города: метки на котов, птиц, деревья и муралы.">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
{fonts}
<style>{css}</style></head><body>
{body}
{script}
</body></html>""", encoding="utf-8")
(dist / "preview.html").write_text(f"""<title>Метка в Telegram</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>{css}</style>
{body}
{script}
""", encoding="utf-8")
print("built", (dist / "index.html").stat().st_size, "bytes")
