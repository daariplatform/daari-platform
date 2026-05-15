#!/usr/bin/env python3
"""
Generates the Daari app icon family from a single SVG-like Pillow draw.

Why not commission a real logo: the user wants to ship within a week and
the current "icon" is a flat solid color, which Google Play rejects on
sight. This produces a recognizable Daari mark (stylized house + water
drop on the brand cyan) — far better than the placeholder, and good
enough to land in stores under "launching pilot, refining branding."

Outputs:
  mobile-{customer,worker}/assets/icon.png              1024x1024  full mark
  mobile-{customer,worker}/assets/adaptive-icon.png     1024x1024  foreground-only (Android)
  mobile-{customer,worker}/assets/splash.png            1284x2778  splash
  mobile-{customer,worker}/assets/notification-icon.png   96x96    monochrome white
  store-assets/feature-graphic-{customer,worker}.png    1024x500   Play Store hero

Run from repo root:
  python3 scripts/generate-icons.py
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent

BRAND_CYAN = (8, 145, 178)        # #0891b2
BRAND_CYAN_DARK = (14, 116, 144)  # #0e7490
BRAND_NAVY = (15, 23, 42)         # #0f172a
WHITE = (255, 255, 255)
BG_LIGHT = (240, 249, 255)        # near-white cyan tint


def find_font(*, arabic: bool = False):
    """
    Best-effort font search. For Latin wordmarks we accept any of macOS's
    bundled families. For Arabic shaping we'd ideally need libraqm — which
    Pillow doesn't always ship with — so the safe fallback is to render
    the Latin transliteration ("DAARI") instead of shaped Arabic. See
    make_feature_graphic() for how this is handled.
    """
    if arabic:
        candidates = [
            "/System/Library/Fonts/Supplemental/Geeza Pro Bold.ttf",
            "/System/Library/Fonts/Supplemental/GeezaPro.ttf",
            "/System/Library/Fonts/GeezaPro.ttc",
            "/Library/Fonts/Arial Unicode.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


# Kept for backwards-compat call site; same as find_font(arabic=True).
def find_arabic_font():
    return find_font(arabic=True)


def draw_house_drop(canvas: Image.Image, size: int, fg=WHITE, with_outline=False):
    """Draws a stylized house outline with a water drop inside, centered."""
    d = ImageDraw.Draw(canvas, 'RGBA')
    cx, cy = size // 2, size // 2

    # House dimensions: roof apex + rectangular base.
    house_w = int(size * 0.56)
    house_h = int(size * 0.46)
    house_left = cx - house_w // 2
    house_right = cx + house_w // 2
    house_top = cy - int(house_h * 0.35)
    house_bottom = cy + int(house_h * 0.55)
    roof_apex = cy - int(house_h * 0.65)

    # Roof (triangle)
    roof = [
        (cx, roof_apex),
        (house_left - int(size * 0.04), house_top + int(size * 0.02)),
        (house_right + int(size * 0.04), house_top + int(size * 0.02)),
    ]
    d.polygon(roof, fill=fg)

    # Walls (rounded rectangle)
    d.rounded_rectangle(
        (house_left, house_top + int(size * 0.005), house_right, house_bottom),
        radius=int(size * 0.04),
        fill=fg,
    )

    # Water drop cut-out: a teardrop shape inside the house.
    drop_cx = cx
    drop_top = cy - int(size * 0.05)
    drop_bottom = cy + int(size * 0.20)
    drop_w = int(size * 0.18)

    # Drop body: an ellipse for the round bottom + triangle for the tip.
    ellipse_top = drop_top + int(size * 0.07)
    d.ellipse(
        (drop_cx - drop_w // 2, ellipse_top, drop_cx + drop_w // 2, drop_bottom),
        fill=BRAND_CYAN,
    )
    d.polygon(
        [
            (drop_cx, drop_top),
            (drop_cx - drop_w // 2 + int(size * 0.008), ellipse_top + int(size * 0.04)),
            (drop_cx + drop_w // 2 - int(size * 0.008), ellipse_top + int(size * 0.04)),
        ],
        fill=BRAND_CYAN,
    )

    if with_outline:
        # Subtle dark outline so the mark stays readable on light backgrounds.
        d.polygon(roof, outline=BRAND_NAVY, width=max(2, size // 200))


def make_icon(size: int, bg_color, foreground_only: bool = False) -> Image.Image:
    img = Image.new('RGBA', (size, size), bg_color + (255,) if not foreground_only else (0, 0, 0, 0))
    draw_house_drop(img, size, fg=WHITE)
    return img


def make_splash(width: int, height: int, bg_color) -> Image.Image:
    img = Image.new('RGBA', (width, height), bg_color + (255,))

    # Centered house+drop motif, then "داري" wordmark below it.
    motif_size = int(min(width, height) * 0.5)
    motif = make_icon(motif_size, bg_color, foreground_only=True)
    img.paste(motif, ((width - motif_size) // 2, (height - motif_size) // 2 - int(height * 0.05)), motif)

    font_path = find_arabic_font()
    if font_path:
        try:
            font = ImageFont.truetype(font_path, int(motif_size * 0.18))
            d = ImageDraw.Draw(img)
            text = "داري"
            bbox = d.textbbox((0, 0), text, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            d.text(
                ((width - tw) // 2, (height + motif_size) // 2 - int(height * 0.02)),
                text,
                font=font,
                fill=WHITE,
            )
        except Exception:
            pass

    return img


def make_notification_icon(size: int = 96) -> Image.Image:
    """Android requires the notification icon to be solid white on transparent."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_house_drop(img, size, fg=WHITE)
    # Force everything to white silhouette: replace BRAND_CYAN pixels (the drop)
    # with semi-transparent white so the silhouette stays uniform.
    pixels = img.load()
    for x in range(size):
        for y in range(size):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Anything visible becomes white; alpha preserved.
                pixels[x, y] = (255, 255, 255, a)
    return img


def make_feature_graphic(width: int = 1024, height: int = 500, subtitle: str = "") -> Image.Image:
    # Subtle vertical gradient from BRAND_CYAN_DARK at the top to BRAND_CYAN
    # at the bottom — adds depth without washing out into grey.
    img = Image.new('RGB', (width, height), BRAND_CYAN)
    d = ImageDraw.Draw(img)
    for y in range(height):
        t = y / height
        r = int(BRAND_CYAN_DARK[0] * (1 - t) + BRAND_CYAN[0] * t)
        g = int(BRAND_CYAN_DARK[1] * (1 - t) + BRAND_CYAN[1] * t)
        b = int(BRAND_CYAN_DARK[2] * (1 - t) + BRAND_CYAN[2] * t)
        d.line([(0, y), (width, y)], fill=(r, g, b))

    # Convert to RGBA so we can paste the motif with alpha.
    img = img.convert('RGBA')

    # Motif on the right (Arabic reading order).
    motif_size = int(height * 0.7)
    motif = make_icon(motif_size, BRAND_CYAN, foreground_only=True)
    motif_x = width - motif_size - int(width * 0.08)
    img.paste(motif, (motif_x, (height - motif_size) // 2), motif)

    # Wordmark on the left. Pillow without libraqm can't shape Arabic
    # properly, so we render the Latin transliteration "DAARI" as the
    # primary wordmark + an English subtitle. That's what the Play Store
    # listing card will show anyway.
    d = ImageDraw.Draw(img)
    font_path = find_font(arabic=False)
    if font_path:
        try:
            title_font = ImageFont.truetype(font_path, int(height * 0.32))
            sub_font = ImageFont.truetype(font_path, int(height * 0.10))

            d.text(
                (int(width * 0.08), int(height * 0.22)),
                "DAARI",
                font=title_font,
                fill=WHITE,
            )

            sub_lat = (
                "Home services, one tap away"
                if "خدمات" in subtitle
                else "For water plant workers"
            )
            d.text(
                (int(width * 0.08), int(height * 0.62)),
                sub_lat,
                font=sub_font,
                fill=(255, 255, 255, 230),
            )
        except Exception as e:
            # Surface failures so this isn't silent in CI
            print(f"   ! text render failed: {e}")

    return img.convert('RGB')


def main():
    apps = ["mobile-customer", "mobile-worker"]
    for app in apps:
        assets = REPO_ROOT / app / "assets"
        assets.mkdir(parents=True, exist_ok=True)

        # icon.png (iOS uses this; Android uses adaptive on >=8.0 but this is
        # the legacy fallback). Cyan background, white house+drop.
        make_icon(1024, BRAND_CYAN).save(assets / "icon.png")

        # adaptive-icon.png: foreground only, transparent background. Android
        # composites it onto adaptiveIcon.backgroundColor (set in app.json).
        make_icon(1024, BRAND_CYAN, foreground_only=True).save(assets / "adaptive-icon.png")

        # splash.png: customer = cyan, worker = navy (matches app.json).
        if app == "mobile-customer":
            make_splash(1284, 2778, BRAND_CYAN).save(assets / "splash.png")
        else:
            make_splash(1284, 2778, BRAND_NAVY).save(assets / "splash.png")

        # notification-icon.png: white silhouette on transparent.
        make_notification_icon(96).save(assets / "notification-icon.png")

        print(f"  ✓ {app}/assets/ — icon, adaptive-icon, splash, notification-icon")

    # Store assets folder.
    store = REPO_ROOT / "store-assets"
    store.mkdir(exist_ok=True)
    make_feature_graphic(1024, 500, "خدمات منزلك بضغطة زر").save(
        store / "feature-graphic-customer.png"
    )
    make_feature_graphic(1024, 500, "تطبيق سائقي معامل المياه").save(
        store / "feature-graphic-worker.png"
    )
    # 512x512 Play Store icon
    make_icon(512, BRAND_CYAN).save(store / "play-store-icon-customer.png")
    make_icon(512, BRAND_CYAN).save(store / "play-store-icon-worker.png")
    print(f"  ✓ store-assets/ — feature graphics + Play Store icons")


if __name__ == "__main__":
    main()
