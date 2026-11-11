"""
Generates a unique branded banner image for one GitHub Release.

Usage:
    uv run --with pillow python generate_release_banner.py \
        --version 2.9.0 \
        --tagline "Wishlist deals, worth-waiting verdicts & a big testing pass" \
        [--icon ../../extension/icons/icon128.png]

Writes store/release-images/v<version>.png (1280x400, RGB, no alpha —
matches the brand palette used in store/*.py and docs/assets/hero-icon.png:
dark near-black background, cyan + magenta glow blobs, the extension's own
plus-mark icon). release.yml embeds this file automatically via its raw
GitHub URL when it exists at that path for the tag being released — see
this repo's CONTRIBUTING.md. Run this and commit the
output BEFORE tagging a release, same step as the changelog/README update.

Two styles. `classic` (1280x400) is the plain banner used for patch releases. `major`
(1280x640) is the special one: big glowing logo, a "NEW VERSION" pill, the version in the
brand gradient, the tagline and up to four highlight chips. A release whose version ends in
".0" (4.5.0, 5.0.0 ...) gets `major` automatically; pass `--style classic` to override, and
`--highlights "24 currencies|9 languages|Tabs after updates|Safer imports"` for the chips.
Rule for the repo: every minor or major release uses the major style.

Only needs Pillow, invoked via `uv run --with pillow` so no project
dependency is added just for this.
"""
import argparse
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "brand"))
import common  # noqa: E402
FONT_DIR = "C:/Windows/Fonts/"
BOLD = FONT_DIR + "seguibl.ttf"
SEMIBOLD = FONT_DIR + "seguisb.ttf"
LIGHT = FONT_DIR + "segoeuil.ttf"

BG_BASE = (10, 6, 18)
ACCENT_CYAN_DEEP = (10, 150, 165)
ACCENT_MAGENTA_DEEP = (130, 40, 190)
TEXT_PRIMARY = (244, 234, 255)
TEXT_MUTED = (168, 150, 200)
ACCENT_CYAN = (0, 240, 255)
ACCENT_MAGENTA = (198, 79, 255)


def make_bg(w, h, ss=3):
    W, H = w * ss, h * ss
    bg = Image.new("RGB", (W, H), BG_BASE)
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx1, cy1, r1 = int(W * 0.10), int(H * 0.15), int(H * 1.3)
    gd.ellipse([cx1 - r1, cy1 - r1, cx1 + r1, cy1 + r1], fill=ACCENT_CYAN_DEEP)
    cx2, cy2, r2 = int(W * 0.92), int(H * 0.9), int(H * 1.3)
    gd.ellipse([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], fill=ACCENT_MAGENTA_DEEP)
    glow = glow.filter(ImageFilter.GaussianBlur(int(H * 0.20)))
    img = Image.composite(
        Image.blend(bg, glow, 0.85), bg,
        glow.convert("L").point(lambda p: min(255, int(p * 1.8)))
    )
    return img.resize((w, h), Image.LANCZOS)


def rounded_square_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return mask


def build_icon(size=220):
    ss = 2
    S = size * ss
    bg = Image.new("RGB", (S, S), BG_BASE)
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(S * -0.1)] * 2 + [int(S * 0.75)] * 2, fill=ACCENT_CYAN_DEEP)
    gd.ellipse([int(S * 0.35)] * 2 + [int(S * 1.2)] * 2, fill=ACCENT_MAGENTA_DEEP)
    glow = glow.filter(ImageFilter.GaussianBlur(int(S * 0.12)))
    img = Image.composite(
        Image.blend(bg, glow, 0.92), bg,
        glow.convert("L").point(lambda p: min(255, int(p * 2.1)))
    )
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S / 2
    half_len, half_thick = S * 0.29, S * 0.085
    d.rounded_rectangle([cx - half_thick, cy - half_len, cx + half_thick, cy + half_len], radius=half_thick, fill=(255, 255, 255))
    d.rounded_rectangle([cx - half_len, cy - half_thick, cx + half_len, cy + half_thick], radius=half_thick, fill=(255, 255, 255))
    img = img.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_square_mask(size, int(size * 0.225)))
    return out


def fit_text(draw, text, font_path, max_size, min_size, max_width):
    size = max_size
    while size > min_size:
        f = ImageFont.truetype(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=f)
        if bbox[2] - bbox[0] <= max_width:
            return f
        size -= 2
    return ImageFont.truetype(font_path, min_size)


def build(version, tagline, out_path, w=1280, h=400):
    img = make_bg(w, h)
    draw = ImageDraw.Draw(img)

    icon_size = 168
    icon = common.draw_logo(icon_size)
    pad_left = 80
    icon_y = (h - icon_size) // 2
    img.paste(icon, (pad_left, icon_y), icon)

    text_x = pad_left + icon_size + 56
    max_text_w = w - text_x - 60

    title = f"GOG Enhancer v{version}"
    title_font = fit_text(draw, title, BOLD, 58, 34, max_text_w)
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_h = title_bbox[3] - title_bbox[1]

    tag_font = fit_text(draw, tagline, LIGHT, 24, 16, max_text_w)
    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_h = tag_bbox[3] - tag_bbox[1]

    gap = 18
    block_h = title_h + gap + tag_h
    top = (h - block_h) // 2

    draw.text((text_x, top - title_bbox[1]), title, font=title_font, fill=TEXT_PRIMARY)
    draw.text((text_x, top + title_h + gap - tag_bbox[1]), tagline, font=tag_font, fill=TEXT_MUTED)

    # bottom accent gradient line, matching the promo images
    for x in range(0, w, 6):
        t = x / w
        col = tuple(int(ACCENT_CYAN[c] + (ACCENT_MAGENTA[c] - ACCENT_CYAN[c]) * t) for c in range(3))
        draw.rectangle([x, h - 5, x + 6, h], fill=col)

    img.save(out_path, "PNG")
    print(f"Wrote {out_path} ({img.size[0]}x{img.size[1]}, mode={img.mode})")


def build_major(version, tagline, out_path, highlights, w=1280, h=640):
    img = common.make_bg(w, h, stars=90, seed=int(version.replace(".", "") or 1))
    d = ImageDraw.Draw(img)
    common.paste_logo(img, 260, 70, (h - 260) // 2 - 20)
    x = 70 + 260 + 60
    pill_f = common.font(common.SEMIBOLD, 22)
    label = "NEW VERSION"
    tw = d.textlength(label, font=pill_f)
    d.rounded_rectangle([x, 120, x + tw + 44, 120 + 44], radius=22, fill=(0, 60, 80), outline=common.CYAN, width=2)
    d.text((x + 22, 142), label, font=pill_f, fill=common.CYAN, anchor="lm")
    d.text((x, 175), "GOG Enhancer", font=common.font(common.BOLD, 66), fill=common.TEXT)
    common.gradient_text(img, (x - 4, 235), f"v{version}", common.font(common.BOLD, 150))
    tag_f = common.fit_text(d, tagline, common.LIGHT, 34, 20, w - x - 60) if hasattr(common, "fit_text") else common.font(common.LIGHT, 30)
    d.text((x, 420), tagline, font=tag_f, fill=(210, 196, 240))
    cx, cy = x, 500
    for g, lab in highlights:
        wd = common.chip(img, cx, cy, lab, size=20, glyph=g)
        cx += wd + 12
        if cx > w - 60:
            cx, cy = x, cy + 62
    common.bottom_line(img, 8)
    img.save(out_path, "PNG")
    print(f"Wrote {out_path} ({img.size[0]}x{img.size[1]}, mode={img.mode}, major style)")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--version", required=True, help="e.g. 2.9.0 (no leading v)")
    p.add_argument("--tagline", required=True)
    p.add_argument("--style", choices=["auto", "classic", "major"], default="auto")
    p.add_argument("--highlights", default="", help='up to four chips, separated by "|"')
    args = p.parse_args()
    out = os.path.join(HERE, f"v{args.version}.png")
    style = args.style
    if style == "auto":
        style = "major" if args.version.endswith(".0") else "classic"
    if style == "major":
        glyphs = ["$", "↗", "#", "◎"]
        chips = [(glyphs[i % 4], t.strip()) for i, t in enumerate([t for t in args.highlights.split("|") if t.strip()][:4])]
        build_major(args.version, args.tagline, out, chips)
    else:
        build(args.version, args.tagline, out)
