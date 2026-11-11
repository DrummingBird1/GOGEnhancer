"""
Chrome Web Store promo images, English and Hebrew:
  store/promo-small-440x280.png        store/promo-marquee-1400x560.png
  store/promo-small-440x280.he.png     store/promo-marquee-1400x560.he.png

    uv run --with pillow python store/brand/promo.py
"""
import os
from PIL import ImageDraw
from common import *  # noqa: F401,F403

ROOT = os.path.abspath(os.path.join(HERE, ".."))

TEXTS = {
    "en": {
        "tag_small": "Live currency, price history & tags for GOG.com",
        "tag_big": "Price history, 24 currencies and your own tags for GOG.com",
        "chips_big": [("$", "24 currencies"), ("↗", "Price history"), ("#", "Tags & notes"), ("◎", "9 languages")],
        "chips_small": [("$", "24 currencies"), ("↗", "Price history")],
    },
    "he": {
        "tag_small": "מטבע חי, היסטוריית מחירים ותגיות ל-GOG.com",
        "tag_big": "היסטוריית מחירים, 24 מטבעות ותגיות משלכם ל-GOG.com",
        "chips_big": [("$", "24 מטבעות"), ("↗", "היסטוריית מחירים"), ("#", "תגיות והערות"), ("◎", "9 שפות")],
        "chips_small": [("$", "24 מטבעות"), ("↗", "היסטוריית מחירים")],
    },
}


def small(lang):
    w, h = 440, 280
    img = make_bg(w, h, stars=25)
    d = ImageDraw.Draw(img)
    t = TEXTS[lang]
    rtl = lang == "he"
    paste_logo(img, 104, (w - 104 - 34) if rtl else 34, 34)
    name_f = font(BOLD, 40)
    ax = (w - 34) if rtl else 34
    anchor = "ra" if rtl else "la"
    d.text((ax, 160), "GOG Enhancer", font=name_f, fill=TEXT, anchor=anchor)
    tag = he(t["tag_small"]) if rtl else t["tag_small"]
    tf = font(REGULAR, 17)
    d.text((ax, 208), tag, font=tf, fill=MUTED, anchor=anchor)
    # chips
    x = ax
    for g, label in t["chips_small"]:
        lab = he(label) if rtl else label
        wd = chip(img, x, 250, lab, size=15, rtl=rtl, glyph=g)
        x += -(wd + 8) if rtl else (wd + 8)
    bottom_line(img, 4)
    img.save(os.path.join(ROOT, "promo-small-440x280" + (".he" if rtl else "") + ".png"))


def marquee(lang):
    w, h = 1400, 560
    img = make_bg(w, h, stars=70)
    d = ImageDraw.Draw(img)
    t = TEXTS[lang]
    rtl = lang == "he"
    card_w = 380
    card_x = 70 if rtl else w - 70 - card_w
    price_card(img, card_x, 90, card_w, 380, he_mode=rtl)
    left = 90
    paste_logo(img, 150, (w - 90 - 150) if rtl else 90, 70)
    # In Hebrew the text block sits to the right of the card, mirrored.
    if rtl:
        ax, anchor = w - 90 - 150 - 36, "ra"
    else:
        ax, anchor = 90 + 150 + 36, "la"
    d.text((ax, 78), "GOG Enhancer", font=font(BOLD, 84), fill=TEXT, anchor=anchor)
    # the logo is 150 high, the title sits beside it
    tag = he(t["tag_big"]) if rtl else t["tag_big"]
    tf = font(LIGHT, 34)
    tx = (w - 90) if rtl else 90
    d.text((tx, 262), tag, font=tf, fill=(205, 190, 235), anchor="ra" if rtl else "la")
    x = tx
    y = 360
    for g, label in t["chips_big"]:
        lab = he(label) if rtl else label
        wd = chip(img, x, y, lab, size=24, rtl=rtl, glyph=g)
        x += -(wd + 12) if rtl else (wd + 12)
        if (not rtl and x > card_x - 30) or (rtl and x < card_x + card_w + 30):
            x = tx
            y += 74
    bottom_line(img, 6)
    img.save(os.path.join(ROOT, "promo-marquee-1400x560" + (".he" if rtl else "") + ".png"))


if __name__ == "__main__":
    for lang in ("en", "he"):
        small(lang)
        marquee(lang)
    print("promo images written")
