"""Export the image-generated orbit logo to Windows icon formats.

The generated artwork is retained in assets/logo-source.png. This script only
resamples and encodes that artwork; it does not draw or redesign the logo.
"""
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
dest = root / 'assets'
source = Path(sys.argv[1]) if len(sys.argv) > 1 else dest / 'logo-source.png'
artwork = Image.open(source).convert('RGBA')
if artwork.width != artwork.height:
    raise ValueError('The logo source must be square.')
icon = artwork.resize((512, 512), Image.Resampling.LANCZOS)
icon.save(dest / 'icon.png')
icon.save(dest / 'app.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('Exported the generated orbit logo to assets/icon.png and assets/app.ico.')
