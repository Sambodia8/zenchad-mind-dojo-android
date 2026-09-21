#!/usr/bin/env python3
"""Prepare ZenChad paper-doll assets on the original 1086x1448 character canvas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SCALE = 4
CANVAS = (1086, 1448)


def polygon_mask(shapes: list[list[tuple[int, int]]], blur: float = 0.8) -> Image.Image:
    mask = Image.new("L", (CANVAS[0] * SCALE, CANVAS[1] * SCALE), 0)
    draw = ImageDraw.Draw(mask)
    for points in shapes:
        draw.polygon([(x * SCALE, y * SCALE) for x, y in points], fill=255)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur * SCALE))
    return mask.resize(CANVAS, Image.Resampling.LANCZOS)


def save_masked(source: Image.Image, shapes: list[list[tuple[int, int]]], output: Path) -> None:
    layer = source.copy()
    layer.putalpha(polygon_mask(shapes))
    output.parent.mkdir(parents=True, exist_ok=True)
    layer.save(output)


def resize_layer(source: Path, output: Path, clip_shapes: list[list[tuple[int, int]]] | None = None) -> None:
    layer = Image.open(source).convert("RGBA").resize(CANVAS, Image.Resampling.LANCZOS)
    if clip_shapes:
        source_alpha = layer.getchannel("A")
        clip_alpha = polygon_mask(clip_shapes, blur=0.5)
        layer.putalpha(Image.composite(source_alpha, Image.new("L", CANVAS, 0), clip_alpha))
    # Transparent pixels must remain black to avoid coloured resize fringes.
    pixels = layer.load()
    for y in range(layer.height):
        for x in range(layer.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                pixels[x, y] = (0, 0, 0, 0)
    output.parent.mkdir(parents=True, exist_ok=True)
    layer.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--neutral-base", required=True, type=Path)
    parser.add_argument("--asset-root", required=True, type=Path)
    parser.add_argument("--qa-dir", type=Path)
    args = parser.parse_args()

    reference = Image.open(args.reference).convert("RGBA")
    neutral = Image.open(args.neutral_base).convert("RGBA")
    if reference.size != CANVAS or neutral.size != CANVAS:
        raise SystemExit(f"reference and neutral base must both be {CANVAS[0]}x{CANVAS[1]}")

    base_path = args.asset_root / "base/zenchad-canonical-underlayer-v3.png"
    base_path.parent.mkdir(parents=True, exist_ok=True)
    neutral.save(base_path)

    # These masks deliberately follow the original silhouette rather than a
    # regenerated model sheet. Slight overlap restores exact reference pixels
    # at garment seams and keeps the face/hair identity stable.
    masks = {
        "hair/default-magenta-spikes-canonical-v3.png": [[
            (405, 237), (420, 177), (464, 128), (526, 103), (598, 119),
            (646, 156), (661, 219), (649, 282), (620, 337), (582, 363),
            (503, 357), (441, 319),
        ]],
        "top/charcoal-training-shirt-canonical-v3.png": [[
            (469, 345), (507, 368), (430, 371), (373, 408), (338, 510),
            (348, 544), (400, 558), (414, 719), (672, 719), (686, 558),
            (738, 544), (748, 510), (713, 408), (653, 371), (580, 368),
            (617, 345),
        ]],
        "wrist/black-fitness-watch-canonical-v3.png": [[
            (674, 694), (758, 694), (756, 789), (666, 789),
        ]],
        "legs/charcoal-training-shorts-canonical-v3.png": [[
            (411, 690), (675, 690), (703, 927), (565, 941), (543, 837),
            (520, 941), (382, 927),
        ]],
        "shoes/black-magenta-trainers-canonical-v3.png": [
            [(370, 1130), (488, 1130), (522, 1418), (286, 1418)],
            [(598, 1130), (716, 1130), (800, 1418), (564, 1418)],
        ],
    }
    for relative, points in masks.items():
        save_masked(reference, points, args.asset_root / "layers" / relative)

    hair_clip = [
        [(397, 251), (414, 174), (471, 126), (548, 111), (625, 137), (674, 191), (681, 269), (647, 321), (611, 287), (475, 287), (438, 330)],
        [(397, 238), (490, 221), (500, 343), (454, 385), (421, 354)],
        [(596, 221), (681, 238), (665, 354), (632, 385), (586, 343)],
    ]
    alternatives = {
        "hair/porter-robinson-nurture-hair-ffix-v2.png": ("hair/porter-robinson-nurture-hair-canonical-v3.png", hair_clip),
        "hair/noodle-dare-hair-ffix-v2.png": ("hair/noodle-dare-hair-canonical-v3.png", hair_clip),
        "hair/silver-lilac-tousled-hair-ffix-v2.png": ("hair/silver-lilac-tousled-hair-canonical-v3.png", hair_clip),
        "top/cream-meditation-jacket-ffix-v2.png": ("top/cream-meditation-jacket-canonical-v3.png", None),
        "wrist/hana-candy-bracelets-ffix-v2.png": ("wrist/hana-candy-bracelets-canonical-v3.png", None),
        "wrist/katie-run-friendship-bracelet-ffix-v2.png": ("wrist/katie-run-friendship-bracelet-canonical-v3.png", None),
    }
    for source_name, (output_name, clip_shapes) in alternatives.items():
        resize_layer(args.asset_root / "layers" / source_name, args.asset_root / "layers" / output_name, clip_shapes)

    if args.qa_dir:
        args.qa_dir.mkdir(parents=True, exist_ok=True)

        def composite(name: str, layer_names: list[str]) -> None:
            preview = neutral.copy()
            for layer_name in layer_names:
                preview.alpha_composite(Image.open(args.asset_root / "layers" / layer_name).convert("RGBA"))
            preview.save(args.qa_dir / name)

        starter = [
            "legs/charcoal-training-shorts-canonical-v3.png",
            "shoes/black-magenta-trainers-canonical-v3.png",
            "top/charcoal-training-shirt-canonical-v3.png",
            "wrist/black-fitness-watch-canonical-v3.png",
            "hair/default-magenta-spikes-canonical-v3.png",
        ]
        composite("starter-layer-composite.png", starter)
        composite("cream-jacket-preview.png", [starter[0], starter[1], "top/cream-meditation-jacket-canonical-v3.png", starter[3], starter[4]])
        composite("porter-hair-preview.png", [starter[0], starter[1], starter[2], starter[3], "hair/porter-robinson-nurture-hair-canonical-v3.png"])
        composite("bracelets-preview.png", [starter[0], starter[1], starter[2], "wrist/hana-candy-bracelets-canonical-v3.png", starter[4]])

    print(f"Prepared canonical paper-doll canvas: {CANVAS[0]}x{CANVAS[1]}")


if __name__ == "__main__":
    main()
