"""Generate a 1200x630 Open Graph image for Tsakani Sessions.

Composites the bear mascot logo and the cursive wordmark on a black canvas
with a subtle gold accent line, matching the brand's gold/dark palette.

Run from repo root:
    python scripts/generate-og-image.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "public" / "images" / "tsakani-logo.png"
WORDS = ROOT / "public" / "images" / "tsakani-words.png"
OUT = ROOT / "public" / "og-image.jpg"

W, H = 1200, 630
BG = (10, 10, 10)         # dark.700
GOLD = (255, 215, 0)      # gold.500


def fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    img = img.copy()
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    return img


def main() -> None:
    canvas = Image.new("RGB", (W, H), BG)

    bear = Image.open(LOGO).convert("RGBA")
    words = Image.open(WORDS).convert("RGBA")

    bear = fit(bear, 460, 520)
    words = fit(words, 640, 420)

    bear_x = 90
    bear_y = (H - bear.height) // 2
    canvas.paste(bear, (bear_x, bear_y), bear)

    words_x = bear_x + bear.width + 40
    words_y = (H - words.height) // 2 - 10
    canvas.paste(words, (words_x, words_y), words)

    draw = ImageDraw.Draw(canvas)
    line_y = H - 60
    draw.line([(90, line_y), (W - 90, line_y)], fill=GOLD, width=2)

    try:
        font = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()

    tagline = "DJ & LIVE ENTERTAINMENT  ·  CAPE TOWN  ·  TSAKANISESSIONS.CO.ZA"
    bbox = draw.textbbox((0, 0), tagline, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, line_y + 14), tagline, font=font, fill=GOLD)

    canvas.save(OUT, "JPEG", quality=88, optimize=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
