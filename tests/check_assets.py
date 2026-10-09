"""Check local assets, exact pixels, content hashes, and preserved game data."""
import hashlib
import json
from pathlib import Path
import re
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text()
manifest = json.loads((ROOT / 'assets/manifest.json').read_text())
expected = ['ancient man', 'witch', 'gangster', 'knight', 'ghost', 'terrify', 'amulet', 'torch', 'hang out', 'potion']
assert json.loads(re.search(r'const words = (\[.*?\]);', html).group(1)) == expected
assert len(manifest) == 13
assert 'https://' not in html and 'http://' not in html
for key, item in manifest.items():
    file = ROOT / item['path']
    assert file.exists() and item['path'] in html
    assert hashlib.sha256(file.read_bytes()).hexdigest()[:16] in file.name
    with Image.open(ROOT / item['source']) as source, Image.open(file) as result:
        assert source.size == result.size
        assert source.convert('RGBA').tobytes() == result.convert('RGBA').tobytes()
for word in expected:
    assert f'"{word}": GAME_ASSETS["{word.replace(" ", "-")}"]' in html
assert 'attempts >= 3' in html and 'fishRemaining = 10' in html
assert html.count('gain.connect(masterGain)') == 5
assert html.count('connect(audioCtx.destination)') == 1
assert 'const SOUND_VOLUME = 0.2' in html
assert 'background: transparent' in html and 'overflow: hidden' in html
print('PASS: 13 local assets, exact pixels/alpha, hashes, vocabulary associations, three attempts, ten fish, five sounds at 20%, transparent stage.')
