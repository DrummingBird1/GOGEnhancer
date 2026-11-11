"""
The GOG Enhancer mark, drawn with Pillow so every size comes from one design:
a violet-to-cyan rounded square, a bold white plus ("adds to the store") and a small
four-point spark ("enhance"). `draw_logo(size)` returns an RGBA image; run this file to
write the extension icons, the store logo, the site favicon and the hero icon.

    uv run --with pillow python store/brand/logo.py
"""
import math
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

C_TOP = (0, 214, 255)      # cyan
C_MID = (112, 64, 255)     # indigo
C_BOT = (214, 62, 255)     # magenta
BASE = 1024


def _gradient(n):
    """Diagonal three-stop gradient, top-left cyan to bottom-right magenta."""
    img = Image.new("RGB", (n, n))
    px = img.load()
    for y in range(n):
        for x in range(n):
            t = (x * 0.45 + y * 0.55) / n
            if t < 0.5:
                u = t / 0.5
                a, b = C_TOP, C_MID
            else:
                u = (t - 0.5) / 0.5
                a, b = C_MID, C_BOT
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))
    return img


def _spark(d, cx, cy, r, fill):
    """Four-point star with concave sides."""
    pts = []
    steps = 64
    for i in range(steps):
        a = 2 * math.pi * i / steps
        k = abs(math.cos(2 * a)) ** 2.2 if False else (abs(math.cos(a)) ** 3 + abs(math.sin(a)) ** 3)
        # concave astroid: radius shrinks between the four tips
        rr = r * (abs(math.cos(a)) ** (2 / 3) + abs(math.sin(a)) ** (2 / 3)) ** (-1.5)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def draw_logo(size=BASE, transparent_corners=True):
    n = BASE
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.225), fill=255)
    body = _gradient(n).convert("RGBA")

    # soft light from the top-left and a darker bottom edge, for depth
    light = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ld = ImageDraw.Draw(light)
    ld.ellipse([-n * 0.35, -n * 0.55, n * 0.75, n * 0.45], fill=(255, 255, 255, 55))
    light = light.filter(ImageFilter.GaussianBlur(n * 0.13))
    body = Image.alpha_composite(body, light)
    shade = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.ellipse([-n * 0.3, n * 0.78, n * 1.3, n * 1.5], fill=(20, 0, 60, 90))
    shade = shade.filter(ImageFilter.GaussianBlur(n * 0.08))
    body = Image.alpha_composite(body, shade)

    # the plus, with a soft shadow
    arm, half = n * 0.17, n * 0.27
    cx, cy = n * 0.46, n * 0.54
    plus = Image.new("L", (n, n), 0)
    pd = ImageDraw.Draw(plus)
    rad = int(arm * 0.42)
    pd.rounded_rectangle([cx - half, cy - arm / 2, cx + half, cy + arm / 2], radius=rad, fill=255)
    pd.rounded_rectangle([cx - arm / 2, cy - half, cx + arm / 2, cy + half], radius=rad, fill=255)
    shadow = plus.filter(ImageFilter.GaussianBlur(n * 0.025)).point(lambda v: int(v * 0.45))
    shadow = ImageChops.offset(shadow, 0, int(n * 0.02))
    body.paste((40, 0, 110, 255), (0, 0), shadow)
    body.paste((255, 255, 255, 255), (0, 0), plus)

    # the spark, top right
    sp = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    _spark(gd, n * 0.745, n * 0.265, n * 0.2, (255, 236, 140, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.05))
    body = Image.alpha_composite(body, glow)
    sdw = ImageDraw.Draw(sp)
    _spark(sdw, n * 0.745, n * 0.265, n * 0.155, (255, 244, 170, 255))
    body = Image.alpha_composite(body, sp)

    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.paste(body, (0, 0), mask)
    # thin inner edge highlight
    edge = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle([3, 3, n - 4, n - 4], radius=int(n * 0.225), outline=(255, 255, 255, 60), width=6)
    out = Image.alpha_composite(out, edge)
    return out.resize((size, size), Image.LANCZOS) if size != n else out


def main():
    big = draw_logo(BASE)
    targets = {
        "extension/icons/icon128.png": 128,
        "extension/icons/icon48.png": 48,
        "extension/icons/icon16.png": 16,
        "store/logo-128x128.png": 128,
        "docs/assets/favicon.png": 48,
        "docs/assets/hero-icon.png": 1024,
    }
    for rel, s in targets.items():
        img = big.resize((s, s), Image.LANCZOS) if s != BASE else big
        img.save(os.path.join(ROOT, rel))
        print("wrote", rel, s)
    big.save(os.path.join(HERE, "logo-1024.png"))


if __name__ == "__main__":
    main()
