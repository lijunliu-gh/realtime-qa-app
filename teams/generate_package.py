"""Generate Teams app icons and package into zip."""
import os
import zipfile
import json
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "appPackage")
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env():
    """Load .env from project root into os.environ (simple key=value parser)."""
    env_path = os.path.join(ROOT_DIR, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


def render_manifest():
    """Read manifest.template.json, substitute {{DOMAIN}} and {{APP_ID}}, write manifest.json."""
    template_path = os.path.join(OUT_DIR, "manifest.template.json")
    output_path = os.path.join(OUT_DIR, "manifest.json")

    domain = os.environ.get("TEAMS_DOMAIN", "")
    app_id = os.environ.get("TEAMS_APP_ID", "")

    if not domain or not app_id:
        print("ERROR: Set TEAMS_DOMAIN and TEAMS_APP_ID in .env or environment.")
        print("  cp .env.example .env  # then edit with your values")
        raise SystemExit(1)

    with open(template_path, encoding="utf-8") as f:
        content = f.read()

    content = content.replace("{{DOMAIN}}", domain)
    content = content.replace("{{APP_ID}}", app_id)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Generated {output_path}")
    print(f"    DOMAIN = {domain}")
    print(f"    APP_ID = {app_id}")

def make_color_icon(path: str, size: int = 192):
    """192x192 color icon: purple rounded square with 'QA' text."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Purple rounded rectangle background
    margin = 8
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=32,
        fill=(107, 47, 160),  # #6b2fa0
    )
    # White "QA" text in center
    font_size = size // 3
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()
    text = "QA"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    # Small lightning bolt accent
    bolt_y = size - margin - 40
    bolt_x = size - margin - 40
    draw.polygon(
        [(bolt_x + 10, bolt_y), (bolt_x + 4, bolt_y + 18),
         (bolt_x + 14, bolt_y + 14), (bolt_x + 8, bolt_y + 32),
         (bolt_x + 22, bolt_y + 10), (bolt_x + 12, bolt_y + 14)],
        fill=(255, 200, 50),
    )
    img.save(path, "PNG")
    print(f"  Created {path} ({size}x{size})")


def make_outline_icon(path: str, size: int = 32):
    """32x32 outline icon: white 'QA' on transparent background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # White border rounded rect
    draw.rounded_rectangle(
        [1, 1, size - 2, size - 2],
        radius=6,
        outline=(255, 255, 255),
        width=2,
    )
    # White "QA" text
    font_size = size // 3
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()
    text = "QA"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    img.save(path, "PNG")
    print(f"  Created {path} ({size}x{size})")


def package_zip():
    """Zip manifest.json + icons into realtimeqa-teams.zip."""
    zip_path = os.path.join(os.path.dirname(OUT_DIR), "realtimeqa-teams.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in ("manifest.json", "color.png", "outline.png"):
            fpath = os.path.join(OUT_DIR, fname)
            zf.write(fpath, fname)
    print(f"  Packaged → {zip_path}")
    return zip_path


if __name__ == "__main__":
    load_env()
    print("Rendering manifest from template...")
    render_manifest()
    print("Generating icons...")
    make_color_icon(os.path.join(OUT_DIR, "color.png"))
    make_outline_icon(os.path.join(OUT_DIR, "outline.png"))
    print("Packaging zip...")
    zip_path = package_zip()
    print(f"\nDone! Upload this to Teams:\n  {zip_path}")
