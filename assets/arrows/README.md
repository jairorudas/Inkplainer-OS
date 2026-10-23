# Arrow pack

79 SVG arrows in 7 styles (marker, sketch, brush, dotted, dashed, sticker, geometric).
Each file is 512×512 with explicit size, so it can be uploaded as an image layer.

- In the app: the **Arrows** button (below Import from R2) opens a picker — choose style, color, rotation, then Add.
- Open `index.html` (via a local server): pick a color, rotation/flip, click an arrow to download it recolored.
- Code: `arrowSVG(ARROW_PACK.marker.items.curve, '#e11d48', 90)` returns the SVG string.
- Regenerate / tweak shapes: `python3 tools/build-arrows.py`.
