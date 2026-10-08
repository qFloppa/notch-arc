// Builds both image assets from public/notch.jpg:
//
//   public/hero.jpg           the mark beside the h1
//   app/opengraph-image.jpg   the 1200x630 link-preview card
//
// Run once and commit the output: `node tools/art.mjs`. They are static assets
// rather than routes so a link preview never waits on a render and the hero
// costs no server work, and so the crop and the type stay reviewable in a diff.
//
// sharp arrives with next, so this adds no dependency. Build-time only —
// nothing in the app imports it.
import sharp from "sharp";
import { statSync } from "node:fs";

const SRC = "public/notch.jpg";
const BG = "#0e1116";                 // --bg
const INK = "#e6edf3";                // --ink
const DIM = "#8b98a5";                // --dim
const ACCENT = "#4f9cf9";             // --accent

// The bar inside notch.jpg, found by luminance scan rather than by eye.
const BAR = { left: 439, top: 183, right: 684, bottom: 1199 };

// Why the source is cropped at all: the render is vignetted, and its background
// falls to luminance 9 at the frame edge against the page's 17.7. Dropped in
// whole it reads as two dark vertical bands either side of the bar. Beside the
// bar the same background sits at 17–20, near enough to the page to vanish, so
// the crop keeps only that band. It also makes the bar the subject instead of a
// small object in a large empty box.
const PAD = 40;
const crop = {
  left: BAR.left - PAD,
  top: BAR.top - PAD,
  width: BAR.right - BAR.left + PAD * 2,
  height: BAR.bottom - BAR.top + PAD * 2,
};

// Feather the frame, not a radial fade: the bar's rounded tips and its blue
// foot sit close to the crop edge, and a radial mask would eat them. An inset
// rounded rect, blurred at its border, leaves the middle fully opaque.
// 22px of fade is 6.8% of the crop width and 2.0% of its height; the bar starts
// at 12.3% and 3.6%, so the fade never touches steel.
const FEATHER = 22;
const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${crop.height}">
     <rect width="${crop.width}" height="${crop.height}" fill="black"/>
     <rect x="${FEATHER}" y="${FEATHER}"
           width="${crop.width - FEATHER * 2}" height="${crop.height - FEATHER * 2}"
           rx="20" fill="white"/>
   </svg>`,
);

const alpha = await sharp(maskSvg).blur(FEATHER / 2).extractChannel(0).toBuffer();

/** The crop with a feathered alpha edge, at native resolution. */
const mark = await sharp(SRC)
  .extract(crop)
  .ensureAlpha()
  .composite([{ input: alpha, blend: "dest-in" }])
  .png()
  .toBuffer();

const flat = (width, height) => ({
  create: { width, height, channels: 4, background: BG },
});

const jpeg = { quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true };

/* ------------------------------------------------------------------- hero */

// Flattened onto --bg rather than kept as an alpha PNG: a photographic crop
// this size costs ~400KB as PNG and 40KB as JPEG, and the page has no light
// theme for the transparency to serve. The trade is that the asset now encodes
// --bg — change that token and this has to be regenerated.
await sharp({ ...flat(crop.width, crop.height) })
  .composite([{ input: mark }])
  .jpeg(jpeg)
  .toFile("public/hero.jpg");

/* ------------------------------------------------------------------- card */

const W = 1200, H = 630;              // the size every scraper expects
const markH = 470;
const markW = Math.round((crop.width / crop.height) * markH);
const markX = W - markW - 150;
const markY = Math.round((H - markH) / 2);

// Flat, deliberately. A radial glow behind the mark reads as a dark box around
// the crop, because notch.jpg's background is darker than any lift the gradient
// applies. Flat --bg matches the crop's own edge, so there is no seam.
//
// Type is hand-broken into lines: librsvg does not wrap, so a <text> that
// overflowed would run off the canvas rather than reflow.
const card = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <rect width="${W}" height="${H}" fill="${BG}"/>
     <rect x="0" y="0" width="${W}" height="4" fill="${ACCENT}"/>
     <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif">
       <text x="96" y="228" font-size="104" font-weight="700" fill="${INK}"
             letter-spacing="-3">Notch</text>
       <text x="96" y="296" font-size="34" font-weight="600" fill="${ACCENT}"
             >a clearing layer for agent micropayments</text>
       <text x="96" y="374" font-size="26" fill="${DIM}">Agents accrue hash-committed notches on a</text>
       <text x="96" y="410" font-size="26" fill="${DIM}">shared tab. Each cycle nets to one signed</text>
       <text x="96" y="446" font-size="26" fill="${DIM}">statement — and a counterparty disputes the</text>
       <text x="96" y="482" font-size="26" fill="${DIM}">statement, not the transaction.</text>
       <text x="96" y="552" font-size="22" fill="${DIM}" letter-spacing="1.5"
             >LIVE ON GENLAYER STUDIONET</text>
     </g>
   </svg>`,
);

const cardMark = await sharp(mark).resize(markW, markH).png().toBuffer();

await sharp(card)
  .composite([{ input: cardMark, left: markX, top: markY }])
  .jpeg(jpeg)
  .toFile("app/opengraph-image.jpg");

for (const f of ["public/hero.jpg", "app/opengraph-image.jpg"]) {
  const m = await sharp(f).metadata();
  console.log(`${f.padEnd(26)} ${m.width}x${m.height}  ${(statSync(f).size / 1024).toFixed(0)}KB`);
}
