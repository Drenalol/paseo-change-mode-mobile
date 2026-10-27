#!/usr/bin/env python3
"""Generate assets/icon.png — dark tile with two chunky swap arrows (⇄):
the amber arrow points right (tap: switch toward Build), the green one
points left (tap again: back toward Plan). Same palette as the
turn-speed icon so the two pills read as one toolbox."""
from PIL import Image, ImageDraw

S = 2048  # supersample 4x -> final 512
BG = (34, 33, 29, 255)        # dark charcoal
AMBER = (235, 168, 52, 255)
GREEN = (122, 190, 122, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

r = int(S * 0.225)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=BG)

W = int(S * 0.10)              # shaft width
X0, X1 = int(S * 0.22), int(S * 0.78)
HEAD_L = int(S * 0.14)         # arrowhead length
HEAD_H = int(S * 0.13)         # arrowhead half-height

def arrow(y: int, right: bool, color) -> None:
    if right:
        d.line([(X0, y), (X1 - HEAD_L, y)], fill=color, width=W)
        tip, base = X1, X1 - HEAD_L
    else:
        d.line([(X0 + HEAD_L, y), (X1, y)], fill=color, width=W)
        tip, base = X0, X0 + HEAD_L
    d.polygon([(tip, y), (base, y - HEAD_H), (base, y + HEAD_H)], fill=color)

arrow(int(S * 0.38), True, AMBER)
arrow(int(S * 0.62), False, GREEN)

img = img.resize((512, 512), Image.LANCZOS)
import os
import pathlib
out = pathlib.Path(__file__).resolve().parent.parent / "assets"
os.makedirs(out, exist_ok=True)
img.save(out / "icon.png")
print(f"wrote {out / 'icon.png'}")
