from pathlib import Path

from PIL import Image


ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "assets" / "yoga"


def remove_generated_checkerboard(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            low = min(red, green, blue)
            spread = max(red, green, blue) - low
            if low > 225 and spread < 20:
                pixels[x, y] = (red, green, blue, 0)
            elif low > 160 and spread < 22:
                softened = max(0, min(alpha, int((225 - low) / 65 * 165)))
                pixels[x, y] = (red, green, blue, softened)
            else:
                pixels[x, y] = (red, green, blue, alpha)

    image.thumbnail((900, 1125), Image.Resampling.LANCZOS)
    image.save(path, optimize=True)


def resize_cover(path: Path) -> None:
    image = Image.open(path).convert("RGB")
    image.thumbnail((1080, 810), Image.Resampling.LANCZOS)
    image.save(path, optimize=True)


remove_generated_checkerboard(ASSET_DIR / "mark-hero-v2.png")
for cover in ASSET_DIR.glob("class-cover-*-v2.png"):
    resize_cover(cover)
