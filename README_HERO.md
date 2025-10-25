How to use a custom hero image

1. Place your desired lavender hero image (example: Screenshot 2025-10-18 at 4.35.38 PM.png) somewhere on your machine.
2. Run the helper script from the project root:

```bash
./scripts/install-hero.sh "/full/path/to/Screenshot 2025-10-18 at 4.35.38 PM.png"
```

3. The script will copy the file to `public/assets/hero-lavender.png`. The app's Hero now references `/assets/hero-lavender.png` and will show the image.
4. If the local image is not present, the hero falls back to an Unsplash image.

Notes:
- After copying, hard-refresh the site (Cmd+Shift+R) to ensure the dev server serves the new asset.
- If you want me to place the image for you, upload the image file into the workspace and I will copy it into `public/assets/hero-lavender.png` automatically.