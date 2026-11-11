"""Shared drawing helpers for the banners and promo images (Pillow only)."""
import math
import os
import random
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from logo import draw_logo  # noqa: E402

FONT_DIR = "C:/Windows/Fonts/"
BOLD = FONT_DIR + "seguibl.ttf"
SEMIBOLD = FONT_DIR + "seguisb.ttf"
REGULAR = FONT_DIR + "segoeui.ttf"
LIGHT = FONT_DIR + "segoeuil.ttf"
SYMBOLS = FONT_DIR + "seguisym.ttf"

BG_BASE = (10, 6, 18)
CYAN = (0, 240, 255)
MAGENTA = (198, 79, 255)
CYAN_DEEP = (10, 150, 165)
MAGENTA_DEEP = (130, 40, 190)
TEXT = (244, 234, 255)
MUTED = (168, 150, 200)
GOLD = (255, 236, 140)


def font(path, size):
    return ImageFont.truetype(path, size)


def he(text):
    """Visual order for Hebrew: Pillow here has no bidi support, so reverse the order of the
    words and of the runs inside them, and the letters of Hebrew runs (numbers and Latin words
    keep their own direction)."""
    out = []
    for tok in re.findall(r"\S+|\s+", text):
        runs = re.findall(r"[֐-׿][֐-׿\-\"']*|[^֐-׿]+", tok)
        out.append("".join(r[::-1] if re.match(r"[֐-׿]", r) else r for r in reversed(runs)))
    return "".join(reversed(out))


def make_bg(w, h, stars=0, seed=7, ss=2):
    W, H = w * ss, h * ss
    bg = Image.new("RGB", (W, H), BG_BASE)
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(H * 1.1)
    gd.ellipse([int(W * 0.06) - r, int(H * 0.1) - r, int(W * 0.06) + r, int(H * 0.1) + r], fill=CYAN_DEEP)
    gd.ellipse([int(W * 0.95) - r, int(H * 0.95) - r, int(W * 0.95) + r, int(H * 0.95) + r], fill=MAGENTA_DEEP)
    glow = glow.filter(ImageFilter.GaussianBlur(int(H * 0.22)))
    img = Image.composite(Image.blend(bg, glow, 0.85), bg, glow.convert("L").point(lambda p: min(255, int(p * 1.8))))
    img = img.resize((w, h), Image.LANCZOS)
    if stars:
        rnd = random.Random(seed)
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for _ in range(stars):
            x, y = rnd.random() * w, rnd.random() * h
            rr = rnd.choice([1, 1, 1.5, 2, 2.5])
            a = rnd.randint(60, 200)
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, a))
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return img


def paste_logo(img, size, x, y, glow=True):
    logo = draw_logo(size)
    if glow:
        g = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        c = (x + size / 2, y + size / 2)
        gd.ellipse([c[0] - size * 0.75, c[1] - size * 0.75, c[0] + size * 0.75, c[1] + size * 0.75], fill=(150, 90, 255, 120))
        g = g.filter(ImageFilter.GaussianBlur(size * 0.22))
        base = img.convert("RGBA")
        base = Image.alpha_composite(base, g)
        img.paste(base.convert("RGB"))
    img.paste(logo, (int(x), int(y)), logo)


def gradient_text(img, xy, text, f, anchor="la"):
    """Text filled with the cyan→magenta brand gradient."""
    d = ImageDraw.Draw(img)
    bbox = d.textbbox(xy, text, font=f, anchor=anchor)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=f, fill=255, anchor=anchor)
    grad = Image.new("RGB", img.size)
    gp = ImageDraw.Draw(grad)
    x0, x1 = bbox[0], bbox[2]
    for x in range(max(0, x0), min(img.size[0], x1 + 1)):
        t = (x - x0) / max(1, x1 - x0)
        gp.line([(x, 0), (x, img.size[1])], fill=tuple(int(CYAN[i] + (MAGENTA[i] - CYAN[i]) * t) for i in range(3)))
    img.paste(grad, (0, 0), mask)
    return bbox


def chip(img, x, y, label, size=22, rtl=False, glyph=None):
    """Pill with a label; returns its width. y is the vertical centre."""
    f = font(SEMIBOLD, size)
    d = ImageDraw.Draw(img, "RGBA")
    text = label
    tw = d.textlength(text, font=f)
    gf = font(SYMBOLS, size)
    gw = d.textlength(glyph + "  ", font=gf) if glyph else 0
    padx, pady = size * 0.8, size * 0.45
    w = tw + gw + padx * 2
    h = size + pady * 2
    left = x - w if rtl else x
    d.rounded_rectangle([left, y - h / 2, left + w, y + h / 2], radius=h / 2, fill=(40, 20, 80, 200), outline=(150, 100, 230, 150), width=2)
    tx = left + padx
    if glyph:
        d.text((tx, y), glyph, font=gf, fill=CYAN, anchor="lm")
        tx += gw
    d.text((tx, y), text, font=f, fill=TEXT, anchor="lm")
    return w


def bottom_line(img, thickness=5):
    w, h = img.size
    d = ImageDraw.Draw(img)
    for x in range(0, w, 4):
        t = x / w
        d.rectangle([x, h - thickness, x + 4, h], fill=tuple(int(CYAN[c] + (MAGENTA[c] - CYAN[c]) * t) for c in range(3)))


def price_card(img, x, y, w, h, he_mode=False):
    """A stylised price panel: converted price, a small sparkline and a 'lowest' badge."""
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle([x, y, x + w, y + h], radius=26, fill=(24, 12, 52, 225), outline=(170, 120, 255, 140), width=2)
    img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))
    d = ImageDraw.Draw(img, "RGBA")
    pad = 28
    d.text((x + pad, y + pad), "The Witcher 3", font=font(SEMIBOLD, 22), fill=MUTED)
    d.text((x + pad, y + pad + 34), "$9.99", font=font(BOLD, 56), fill=TEXT)
    cur = "≈ ₪36.4" if True else ""
    d.text((x + pad, y + pad + 104), cur, font=font(SEMIBOLD, 28), fill=CYAN)
    # sparkline
    pts = [0.62, 0.62, 0.45, 0.62, 0.5, 0.5, 0.2, 0.5, 0.35, 0.9]
    sx0, sx1, sy0, sy1 = x + pad, x + w - pad, y + h - 150, y + h - 58
    line = [(sx0 + (sx1 - sx0) * i / (len(pts) - 1), sy0 + (sy1 - sy0) * p) for i, p in enumerate(pts)]
    d.line(line, fill=MAGENTA, width=5, joint="curve")
    lx, ly = line[-1]
    d.ellipse([lx - 9, ly - 9, lx + 9, ly + 9], fill=GOLD)
    d.rounded_rectangle([x + pad, y + h - 48, x + pad + 215, y + h - 14], radius=17, fill=(255, 236, 140, 235))
    d.text((x + pad + 107, y + h - 31), "💎 Lowest price" if False else "Lowest price", font=font(BOLD, 19), fill=(40, 20, 0), anchor="mm")


def fit_text(draw, text, font_path, max_size, min_size, max_width):
    size = max_size
    while size > min_size:
        f = font(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=f)
        if bbox[2] - bbox[0] <= max_width:
            return f
        size -= 2
    return font(font_path, min_size)
