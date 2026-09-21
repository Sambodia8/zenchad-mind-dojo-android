#!/usr/bin/env python3
"""Refit existing transparent paper-doll layers to the restored ZenChad rig."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_scale(value: str) -> tuple[float, float]:
    parts = tuple(float(part.strip()) for part in value.split(","))
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("scale must be x,y")
    return parts


def parse_offset(value: str) -> tuple[int, int]:
    parts = tuple(int(part.strip()) for part in value.split(","))
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("offset must be x,y")
    return parts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--scale", required=True, type=parse_scale)
    parser.add_argument("--offset", default=(0, 0), type=parse_offset)
    parser.add_argument("--center-x", type=float, default=512.0)
    parser.add_argument("--center-y", type=float, default=768.0)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    alpha_box = source.getchannel("A").getbbox()
    if not alpha_box:
        raise SystemExit("input layer has no visible pixels")

    x0, y0, x1, y1 = alpha_box
    crop = source.crop(alpha_box)
    scale_x, scale_y = args.scale
    width = max(1, round(crop.width * scale_x))
    height = max(1, round(crop.height * scale_y))
    resized = crop.resize((width, height), Image.Resampling.LANCZOS)

    old_center_x = (x0 + x1) / 2
    old_center_y = (y0 + y1) / 2
    new_center_x = args.center_x + (old_center_x - args.center_x) * scale_x + args.offset[0]
    new_center_y = args.center_y + (old_center_y - args.center_y) * scale_y + args.offset[1]
    paste_x = round(new_center_x - width / 2)
    paste_y = round(new_center_y - height / 2)

    canvas = Image.new("RGBA", source.size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, (paste_x, paste_y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output)
    print(f"{args.input} {alpha_box} -> ({paste_x},{paste_y},{paste_x + width},{paste_y + height})")


if __name__ == "__main__":
    main()
