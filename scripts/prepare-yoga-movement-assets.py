from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "assets" / "stretches"
OUTPUT_DIR = SOURCE_DIR / "display"
ALPHA_THRESHOLD = 8
PADDING_RATIO = 0.05
MIN_PADDING_PX = 12
NON_MOVEMENT_ASSETS = {"asset-contact-sheet.png", "sun-salutation-flow.png"}


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return mask.getbbox()


def crop_for_display(source: Path) -> tuple[Path, tuple[int, int], tuple[int, int]]:
    relative = source.relative_to(SOURCE_DIR)
    destination = OUTPUT_DIR / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGBA")
    bounds = visible_bounds(image)
    if bounds is None:
        crop_box = (0, 0, image.width, image.height)
    else:
        left, top, right, bottom = bounds
        foreground_width = right - left
        foreground_height = bottom - top
        padding_x = max(MIN_PADDING_PX, round(foreground_width * PADDING_RATIO))
        padding_y = max(MIN_PADDING_PX, round(foreground_height * PADDING_RATIO))
        crop_box = (
            max(0, left - padding_x),
            max(0, top - padding_y),
            min(image.width, right + padding_x),
            min(image.height, bottom + padding_y),
        )

    cropped = image.crop(crop_box)
    cropped.save(destination, optimize=True)
    return destination, image.size, cropped.size


def main() -> None:
    sources = sorted(
        path
        for path in SOURCE_DIR.rglob("*.png")
        if OUTPUT_DIR not in path.parents and path.name not in NON_MOVEMENT_ASSETS
    )
    if not sources:
        raise SystemExit(f"No PNG movement assets found under {SOURCE_DIR}")

    for source in sources:
        destination, original_size, display_size = crop_for_display(source)
        print(
            f"{source.relative_to(SOURCE_DIR)}: "
            f"{original_size[0]}x{original_size[1]} -> "
            f"{display_size[0]}x{display_size[1]} "
            f"({destination.relative_to(ROOT)})"
        )


if __name__ == "__main__":
    main()
