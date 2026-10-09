"""Download originals once and generate lossless, content-addressed game assets."""
import hashlib
import io
import json
import re
from pathlib import Path
import time
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/manifest.json'

def main():
    manifest = json.loads(MANIFEST.read_text())
    for key, item in manifest.items():
        source = ROOT / item['source']
        if not source.exists():
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(item['origin'], timeout=30) as response:
                        data = response.read()
                    with Image.open(io.BytesIO(data)) as image:
                        image.verify()
                    source.write_bytes(data)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
        with Image.open(source) as original:
            image = original.convert('RGBA')
            buffer = io.BytesIO()
            image.save(buffer, 'WEBP', lossless=True, quality=100, method=6, exact=True)
            data = buffer.getvalue()
            with Image.open(io.BytesIO(data)) as optimized:
                assert optimized.convert('RGBA').tobytes() == image.tobytes(), key
            digest = hashlib.sha256(data).hexdigest()[:16]
            output = f'assets/{key}.{digest}.webp'
            (ROOT / output).write_bytes(data)
            item.update(path=output, originalBytes=source.stat().st_size, optimizedBytes=len(data), width=image.width, height=image.height)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    paths = {key: item['path'] for key, item in manifest.items()}
    entry = ROOT / 'index.html'
    html = entry.read_text()
    mapping = '// ASSET_MAP_START\nconst GAME_ASSETS = ' + json.dumps(paths, indent=2) + ';\n// ASSET_MAP_END'
    entry.write_text(re.sub(r'// ASSET_MAP_START.*?// ASSET_MAP_END', lambda match: mapping, html, flags=re.S))
    # Retain old hashed files: cached entry points may still reference them.
    before = sum(item['originalBytes'] for item in manifest.values())
    after = sum(item['optimizedBytes'] for item in manifest.values())
    print(f'{len(manifest)} images: {before:,} -> {after:,} bytes ({(1-after/before)*100:.1f}% smaller); exact RGBA pixels verified.')

if __name__ == '__main__':
    main()
