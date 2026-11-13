"""Draw the three technology stills. Storybook washes, no glyphs.

Rerun from the repo root:

    python docs/scaling/journals/technology/make-stills.py

Writes public/images/journals/technology/<clip>.webp at 1152x768.
Same seed, same pixels. The script never calls a text draw.
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1152, 768
OUT = Path("public/images/journals/technology")


def paper(seed: int, base: tuple[int, int, int]) -> Image.Image:
    noise = np.random.default_rng(seed).integers(-14, 15, size=(H, W), dtype=np.int16)
    rgb = np.zeros((H, W, 3), dtype=np.int16)
    for i, channel in enumerate(base):
        rgb[:, :, i] = np.clip(channel + noise, 0, 255)
    return Image.fromarray(rgb.astype(np.uint8), "RGB")


def wash(
    rng: random.Random,
    size: tuple[int, int],
    color: tuple[int, int, int],
    count: int,
    alpha: tuple[int, int],
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    w, h = size
    for _ in range(count):
        rw = rng.randint(w // 6, w // 2)
        rh = rng.randint(h // 8, h // 2)
        x = rng.randint(-rw // 3, w)
        y = rng.randint(-rh // 3, h)
        draw.ellipse(
            [x, y, x + rw, y + rh],
            fill=(*color, rng.randint(alpha[0], alpha[1])),
        )
    return layer.filter(ImageFilter.GaussianBlur(22))


def listener(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    coat = (92, 64, 48, 230)
    skin = (214, 170, 132, 240)
    draw.ellipse([x - 28, y - 150, x + 28, y - 94], fill=skin)
    draw.rounded_rectangle([x - 46, y - 96, x + 40, y + 70], radius=22, fill=coat)
    draw.polygon([(x + 18, y - 70), (x + 78, y - 20), (x + 18, y - 10)], fill=coat)
    horn = (176, 154, 112, 255)
    draw.rounded_rectangle([x + 8, y - 124, x + 28, y - 78], radius=6, fill=horn)


def figure_with_phone(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    coat = (48, 72, 96, 235)
    skin = (206, 164, 128, 245)
    draw.ellipse([x - 26, y - 168, x + 26, y - 116], fill=skin)
    draw.rounded_rectangle([x - 48, y - 118, x + 42, y + 80], radius=24, fill=coat)
    draw.polygon([(x + 20, y - 90), (x + 96, y - 30), (x + 24, y - 8)], fill=coat)
    phone = (54, 58, 62, 255)
    px, py = x + 58, y - 118
    draw.rounded_rectangle([px, py, px + 36, py + 108], radius=6, fill=phone)


def cabinet(draw: ImageDraw.ImageDraw, x: int, y: int, h: int) -> None:
    body = (74, 86, 78, 235)
    draw.rounded_rectangle([x, y, x + 78, y + h], radius=6, fill=body)
    tube = (122, 104, 72, 220)
    for row in range(6):
        for col in range(3):
            cx = x + 16 + col * 20
            cy = y + 18 + row * 22
            if cy + 8 < y + h - 10:
                draw.ellipse([cx, cy, cx + 10, cy + 10], fill=tube)


def paste_wash(base: Image.Image, layer: Image.Image) -> None:
    base.paste(layer, (0, 0), layer)


def scene_first_phone(rng: random.Random) -> Image.Image:
    base = paper(1, (214, 186, 150)).convert("RGBA")
    paste_wash(base, wash(rng, (W, H), (168, 122, 86), 14, (40, 80)))
    paste_wash(base, wash(rng, (W, H), (120, 96, 74), 8, (50, 90)))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.polygon([(0, 430), (W, 390), (W, H), (0, H)], fill=(112, 78, 52, 180))
    for i in range(5):
        y = 80 + i * 36
        draw.polygon([(0, y), (W, y + 18), (W, y + 34), (0, y + 16)], fill=(92, 62, 40, 90))
    pts = []
    for i in range(40):
        t = i / 39
        x = 70 + t * 860
        y = 300 + 18 * np.sin(t * 3.2) + t * 24
        pts.append((x, y))
    draw.line(pts, fill=(62, 48, 36, 255), width=4)
    wave = []
    for i in range(40):
        t = i / 39
        x = 70 + t * 860
        y = 300 + 18 * np.sin(t * 3.2) + t * 24 - 16 * np.sin(t * 18)
        wave.append((x, y))
    draw.line(wave, fill=(78, 108, 132, 210), width=3)
    listener(draw, 980, 430)
    return base.convert("RGB")


def scene_mobile(rng: random.Random) -> Image.Image:
    base = paper(2, (186, 206, 214)).convert("RGBA")
    paste_wash(base, wash(rng, (W, H), (92, 124, 148), 12, (40, 85)))
    paste_wash(base, wash(rng, (W, H), (210, 170, 120), 6, (25, 55)))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.rectangle([0, 520, W, H], fill=(78, 86, 84, 160))
    blocks = [(40, 280, 180, 540), (190, 200, 340, 540), (360, 320, 470, 540), (760, 240, 920, 540), (930, 300, 1100, 540)]
    for x0, y0, x1, y1 in blocks:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=4, fill=(64, 78, 90, 200))
        for wy in range(y0 + 24, y1 - 20, 36):
            for wx in range(x0 + 16, x1 - 16, 28):
                draw.rectangle([wx, wy, wx + 12, wy + 16], fill=(186, 196, 176, 90))
    figure_with_phone(draw, 560, 470)
    arcs = [(640, 300, 860, 520), (660, 260, 920, 500), (680, 220, 980, 480)]
    for box in arcs:
        draw.arc(box, start=200, end=330, fill=(232, 214, 170, 170), width=4)
    return base.convert("RGB")


def scene_eniac(rng: random.Random) -> Image.Image:
    base = paper(3, (168, 176, 166)).convert("RGBA")
    paste_wash(base, wash(rng, (W, H), (86, 102, 96), 16, (45, 90)))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.rectangle([0, 0, W, 90], fill=(54, 62, 60, 200))
    draw.polygon([(80, 620), (1070, 560), (1120, H), (40, H)], fill=(92, 96, 90, 180))
    for i, x in enumerate(range(70, 430, 92)):
        cabinet(draw, x, 150 + (i % 2) * 12, 430)
    for i, x in enumerate(range(700, 1060, 92)):
        cabinet(draw, x, 140 + (i % 2) * 14, 450)
    for i, x in enumerate(range(430, 700, 90)):
        cabinet(draw, x, 120, 280)
    return base.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    scenes = {
        "first-phone": scene_first_phone,
        "mobile-phone": scene_mobile,
        "eniac": scene_eniac,
    }
    for name, paint in scenes.items():
        rng = random.Random(name)
        image = paint(rng)
        if image.size != (W, H):
            raise SystemExit(f"{name} is {image.size}, expected {(W, H)}")
        path = OUT / f"{name}.webp"
        image.save(path, "WEBP", quality=82, method=6)
        print(f"{path} {image.size[0]}x{image.size[1]} {path.stat().st_size}")


if __name__ == "__main__":
    main()
