#!/usr/bin/env python3
"""Extract a posed paper-doll layer from aligned base and dressed renders."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def parse_box(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part.strip()) for part in value.split(","))
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("box must be x0,y0,x1,y1")
    return parts


def largest_components(mask: np.ndarray, count: int) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[list[tuple[int, int]]] = []
    for y, x in zip(*np.nonzero(mask)):
        if visited[y, x]:
            continue
        queue = deque([(int(y), int(x))])
        visited[y, x] = True
        component: list[tuple[int, int]] = []
        while queue:
            cy, cx = queue.popleft()
            component.append((cy, cx))
            for ny in range(max(0, cy - 1), min(height, cy + 2)):
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    if mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))
        components.append(component)
    result = np.zeros_like(mask, dtype=np.uint8)
    for component in sorted(components, key=len, reverse=True)[:count]:
        for y, x in component:
            result[y, x] = 255
    return result


def fill_holes(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    background = mask == 0
    exterior = np.zeros_like(background, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if background[0, x]:
            queue.append((0, x))
        if background[height - 1, x]:
            queue.append((height - 1, x))
    for y in range(height):
        if background[y, 0]:
            queue.append((y, 0))
        if background[y, width - 1]:
            queue.append((y, width - 1))
    while queue:
        y, x = queue.popleft()
        if exterior[y, x] or not background[y, x]:
            continue
        exterior[y, x] = True
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width and not exterior[ny, nx]:
                queue.append((ny, nx))
    return np.where(exterior, 0, 255).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--dressed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--box", required=True, type=parse_box)
    parser.add_argument("--threshold", type=float, default=40.0)
    parser.add_argument("--components", type=int, default=1)
    parser.add_argument("--close", type=int, default=7)
    parser.add_argument("--expand", type=int, default=9)
    parser.add_argument("--feather", type=float, default=0.8)
    parser.add_argument(
        "--erase-box",
        action="append",
        type=parse_box,
        default=[],
        help="zero alpha inside x0,y0,x1,y1; repeat for known non-wearable leakage",
    )
    parser.add_argument(
        "--exclude-skin",
        action="store_true",
        help="remove warm skin-coloured dressed pixels from dark clothing/accessory layers",
    )
    parser.add_argument(
        "--exclude-aura",
        action="store_true",
        help="remove strongly blue indigo-aura pixels from foreground wearable layers",
    )
    args = parser.parse_args()

    base = Image.open(args.base).convert("RGB")
    dressed = Image.open(args.dressed).convert("RGB")
    if base.size != dressed.size:
        raise SystemExit(f"images must match: base={base.size}, dressed={dressed.size}")

    base_pixels = np.asarray(base, dtype=np.int16)
    dressed_pixels = np.asarray(dressed, dtype=np.int16)
    difference = np.linalg.norm(dressed_pixels - base_pixels, axis=2)
    x0, y0, x1, y1 = args.box
    crop_mask = (difference[y0:y1, x0:x1] >= args.threshold).astype(np.uint8) * 255
    mask_image = Image.fromarray(crop_mask, mode="L")
    if args.close > 1:
        size = args.close if args.close % 2 else args.close + 1
        mask_image = mask_image.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.MinFilter(size))
    if args.components < 1:
        raise SystemExit("components must be at least 1")
    component = largest_components(np.asarray(mask_image) > 0, args.components)
    component = fill_holes(component)
    component_image = Image.fromarray(component, mode="L")
    if args.expand > 1:
        size = args.expand if args.expand % 2 else args.expand + 1
        component_image = component_image.filter(ImageFilter.MaxFilter(size))
    if args.feather > 0:
        component_image = component_image.filter(ImageFilter.GaussianBlur(args.feather))

    full_alpha = Image.new("L", base.size, 0)
    full_alpha.paste(component_image, (x0, y0))
    if args.exclude_skin:
        red = dressed_pixels[:, :, 0]
        green = dressed_pixels[:, :, 1]
        blue = dressed_pixels[:, :, 2]
        skin = (
            (red > 130)
            & (green > 70)
            & (blue < 130)
            & (red > green * 1.15)
            & (green > blue * 1.05)
        )
        alpha_pixels = np.asarray(full_alpha).copy()
        alpha_pixels[skin] = 0
        full_alpha = Image.fromarray(alpha_pixels, mode="L")
    if args.exclude_aura:
        red = dressed_pixels[:, :, 0]
        green = dressed_pixels[:, :, 1]
        blue = dressed_pixels[:, :, 2]
        aura = (blue > 45) & (blue > red * 1.25) & (blue > green * 1.1)
        alpha_pixels = np.asarray(full_alpha).copy()
        alpha_pixels[aura] = 0
        full_alpha = Image.fromarray(alpha_pixels, mode="L")
    for erase_x0, erase_y0, erase_x1, erase_y1 in args.erase_box:
        full_alpha.paste(0, (erase_x0, erase_y0, erase_x1, erase_y1))
    layer = dressed.convert("RGBA")
    layer.putalpha(full_alpha)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    layer.save(args.output)

    if args.preview:
        preview = base.convert("RGBA")
        preview.alpha_composite(layer)
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        preview.convert("RGB").save(args.preview)

    alpha = np.asarray(full_alpha)
    ys, xs = np.nonzero(alpha > 8)
    if len(xs) == 0:
        raise SystemExit("no foreground layer extracted")
    print(
        f"canvas={base.width}x{base.height} "
        f"bounds=({xs.min()},{ys.min()})-({xs.max() + 1},{ys.max() + 1}) "
        f"size={xs.max() - xs.min() + 1}x{ys.max() - ys.min() + 1}"
    )


if __name__ == "__main__":
    main()
