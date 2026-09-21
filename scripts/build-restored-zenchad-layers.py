#!/usr/bin/env python3
"""Build clean starter layers from the restored, aligned ZenChad render."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SCALE = 4


def scaled(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return [(x * SCALE, y * SCALE) for x, y in points]


def silhouette(size: tuple[int, int], shapes: list[list[tuple[int, int]]], holes: list[list[tuple[int, int]]] | None = None) -> Image.Image:
    mask = Image.new("L", (size[0] * SCALE, size[1] * SCALE), 0)
    draw = ImageDraw.Draw(mask)
    for points in shapes:
        draw.polygon(scaled(points), fill=255)
    for points in holes or []:
        draw.polygon(scaled(points), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(1.6))
    return mask.resize(size, Image.Resampling.LANCZOS)


def save_layer(source: Image.Image, mask: Image.Image, output: Path) -> None:
    masked = source.copy()
    masked.putalpha(mask)
    layer = Image.new("RGBA", source.size, (0, 0, 0, 0))
    layer.alpha_composite(masked)
    output.parent.mkdir(parents=True, exist_ok=True)
    layer.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dressed", required=True, type=Path)
    parser.add_argument("--top", required=True, type=Path)
    parser.add_argument("--legs", required=True, type=Path)
    parser.add_argument("--shoes", required=True, type=Path)
    args = parser.parse_args()

    dressed = Image.open(args.dressed).convert("RGBA")
    size = dressed.size
    if size != (1024, 1536):
        raise SystemExit(f"expected 1024x1536 source, received {size[0]}x{size[1]}")

    top = silhouette(
        size,
        [[
            (452, 334), (480, 370), (410, 370), (367, 391), (327, 505),
            (329, 529), (378, 544), (389, 529), (399, 719), (623, 719),
            (637, 529), (647, 544), (696, 529), (698, 505), (657, 391),
            (608, 370), (572, 380), (572, 334),
        ]],
        [[(470, 342), (487, 381), (503, 412), (521, 412), (540, 381), (555, 342)]],
    )
    legs = silhouette(
        size,
        [[
            (399, 699), (623, 699), (646, 902), (531, 922), (512, 835),
            (494, 922), (377, 904),
        ]],
    )
    shoes = silhouette(
        size,
        [
            [(383, 1208), (440, 1208), (458, 1280), (483, 1320), (475, 1388), (311, 1407), (307, 1362), (339, 1284)],
            [(584, 1208), (642, 1208), (678, 1283), (716, 1362), (712, 1407), (550, 1388), (542, 1320)],
        ],
    )

    save_layer(dressed, top, args.top)
    save_layer(dressed, legs, args.legs)
    save_layer(dressed, shoes, args.shoes)


if __name__ == "__main__":
    main()
