# Halloween Fish Word Game

This independent game retains its ten original vocabulary puzzles, images, three attempts per fish, and victory sequence. It runs as a static website with no runtime dependencies.

## Run locally

From the project folder, run `python3 -m http.server 8765`, then open http://localhost:8765. Keep `index.html` and `assets/` together. No GitHub Pages settings or public URL changes are needed.

## Replace or optimize images

Create a Python environment and install Pillow:

```sh
python3 -m venv /tmp/fish-image-tools
/tmp/fish-image-tools/bin/pip install 'Pillow==11.3.0'
/tmp/fish-image-tools/bin/python scripts/optimize_assets.py
```

Original PNGs are retained in `assets/source/`. Replace the appropriate original there, keeping its name, then rerun the optimizer. `assets/manifest.json` records source URLs for provenance and downloads missing originals only; the game never requests these URLs. The optimizer creates lossless WebP images, verifies every RGBA pixel (including transparency), names files from their SHA-256 content, and automatically updates the inline asset map in `index.html`. It does not resize or alter artwork. Unchanged images retain their filenames. Old hashed files are deliberately retained to support cached older entry points; do not immediately delete them after an update.

## Test

```sh
/tmp/fish-image-tools/bin/python tests/check_assets.py
node tests/browser.cjs
```

The browser test requires macOS Google Chrome (or set `CHROME_PATH`) and the local server running on port 8765. It tests image decoding, game completion, three attempts, audio routing, transparent scaled layouts, actual mouse/touch input, iframe sizing, and failed image recovery. Screenshots are saved to `/tmp/second-fish-*.png`. These are local browser/iframe tests, not a test inside the Genially service.

## Embedding and loading

The transparent 1280×720 stage scales proportionally and stays centered inside its iframe. Use a 16:9 Genially embed for edge-to-edge composition. Other aspect ratios necessarily leave transparent unused space to preserve proportions without cropping. The original translucent modal shade remains part of the design. Images use shared loading promises, decoding, eight-second timeouts, and three attempts. Essential assets retry startup; a failed puzzle releases its fish without consuming an attempt so it can be clicked again. Puzzle preloading uses two workers. All five sound effects pass through one 0.2 master gain, preserving their original pitches and envelopes.

## Updates and caching

Review and commit/push the changed HTML and assets yourself. Content changes generate new asset URLs, while unchanged assets can stay cached. The asset map is inline so it cannot become stale independently from the HTML. GitHub Pages/CDN/browser caches can still serve older HTML temporarily; static HTML meta tags cannot control GitHub's response cache headers or guarantee immediate invalidation. Reload the embed after deployment has completed; a hard refresh can help your browser, but other visitors or the CDN may need time to refresh. There is no service worker or permanent cache-busting query parameter. Retaining old hashed assets lets old HTML keep working during this transition.
