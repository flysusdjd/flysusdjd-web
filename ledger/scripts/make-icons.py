"""生成 PWA 图标：512 与 192。

用法 / usage: python ledger/scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "web" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

ACCENT = (180, 71, 31)
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def make(size: int, maskable: bool) -> Image.Image:
    scale = 4  # 先画大图再缩小，边缘更干净
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(s * 0.10) if not maskable else 0
    radius = int(s * 0.22)
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=radius, fill=ACCENT)

    glyph = "记"
    font = load_font(int(s * (0.52 if not maskable else 0.42)))
    box = d.textbbox((0, 0), glyph, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), glyph, font=font, fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


for size in (192, 512):
    make(size, maskable=False).save(OUT / f"icon-{size}.png")
    make(size, maskable=True).save(OUT / f"icon-maskable-{size}.png")

# 顺带给浏览器标签页用的 32px
make(32, maskable=False).save(OUT / "icon-32.png")
print("icons ->", OUT)
