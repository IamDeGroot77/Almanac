// Generates app icons from assets/icon-new.png (any format jimp reads).
//   icon.png                     full artwork, 1024x1024
//   android-icon-foreground.png  journal + trimmings only, centred in the safe zone
//   android-icon-background.png  solid brand blue sampled from the artwork
//   android-icon-monochrome.png  white silhouette of the journal
//   favicon.png / splash-icon.png  journal on transparent
const Jimp = require('jimp-compact');
const path = require('path');
const fs = require('fs');
const assets = path.join(__dirname, '..', 'assets');

// Region of the 1024 artwork holding the journal and its trimmings.
const CROP = { x: 230, y: 360, w: 570, h: 460 };
// Patch inside the rounded square used to pick the background colour.
const SAMPLE = { x: 150, y: 500, w: 40, h: 60 };

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

(async () => {
  const src = await Jimp.read(path.join(assets, 'icon-new.png'));
  const full = src.clone().cover(1024, 1024);
  await full.clone().writeAsync(path.join(assets, 'icon.png'));

  let r = 0, g = 0, b = 0, n = 0;
  for (let y = SAMPLE.y; y < SAMPLE.y + SAMPLE.h; y += 2)
    for (let x = SAMPLE.x; x < SAMPLE.x + SAMPLE.w; x += 2) {
      const c = Jimp.intToRGBA(full.getPixelColor(x, y)); r += c.r; g += c.g; b += c.b; n++;
    }
  const blue = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  console.log('brand blue', toHex(blue));

  // Cut the journal out of the blue by hue: blue background pixels have B well
  // above R and G. Anything else (leather, paper, brass, plant, calendar,
  // sparkles) stays. Alpha ramps so edges stay soft.
  const crop = full.clone().crop(CROP.x, CROP.y, CROP.w, CROP.h);
  crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, function (x, y, idx) {
    const R = this.bitmap.data[idx], G = this.bitmap.data[idx + 1], B = this.bitmap.data[idx + 2];
    const blueness = B - Math.max(R, G * 0.9); // > 0 means blue dominates
    const sat = Math.max(R, G, B) - Math.min(R, G, B);
    if (blueness > 30 && sat > 40) this.bitmap.data[idx + 3] = 0;
    else if (blueness > 10 && sat > 40) this.bitmap.data[idx + 3] = Math.round(255 * (1 - (blueness - 10) / 20));
  });

  const fg = new Jimp(1024, 1024, 0x00000000);
  const art = crop.clone().scaleToFit(640, 640);
  fg.composite(art, Math.round((1024 - art.bitmap.width) / 2), Math.round((1024 - art.bitmap.height) / 2));
  await fg.writeAsync(path.join(assets, 'android-icon-foreground.png'));

  const bg = new Jimp(1024, 1024, Jimp.rgbaToInt(blue.r, blue.g, blue.b, 255));
  await bg.writeAsync(path.join(assets, 'android-icon-background.png'));

  const mono = fg.clone();
  mono.scan(0, 0, mono.bitmap.width, mono.bitmap.height, function (x, y, idx) {
    const a = this.bitmap.data[idx + 3];
    this.bitmap.data[idx] = 255; this.bitmap.data[idx + 1] = 255; this.bitmap.data[idx + 2] = 255;
    this.bitmap.data[idx + 3] = a > 60 ? 255 : 0;
  });
  await mono.writeAsync(path.join(assets, 'android-icon-monochrome.png'));

  const artOnly = fg.clone().autocrop();
  await artOnly.clone().scaleToFit(512, 512).writeAsync(path.join(assets, 'splash-icon.png'));
  await artOnly.clone().scaleToFit(64, 64).writeAsync(path.join(assets, 'favicon.png'));

  fs.writeFileSync(path.join(__dirname, '..', '.brand.json'), JSON.stringify({ blue: toHex(blue) }));
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
