// Renders the favicon PNGs and the social card from the SVG/HTML sources.
//   node tools/render.js
// Needs Playwright with a Chromium (PLAYWRIGHT_BROWSERS_PATH or `npx playwright install chromium`).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const uri = (p) => "file://" + path.join(ROOT, p);

async function shotSvg(page, svgFile, size, out) {
  const svg = fs.readFileSync(path.join(ROOT, svgFile), "utf8")
    .replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: path.join(ROOT, out), omitBackground: true });
  console.log("wrote", out);
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--font-render-hinting=none"] });
  // ignoreHTTPSErrors lets Google Fonts load behind corporate/CI proxies
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  await shotSvg(page, "favicon.svg", 32, "favicon-32x32.png");
  await shotSvg(page, "favicon.svg", 180, "apple-touch-icon.png");
  await shotSvg(page, "favicon.svg", 192, "icon-192.png");
  await shotSvg(page, "favicon.svg", 512, "icon-512.png");

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await og.goto(uri("tools/og-card.html"));
  await og.waitForFunction("document.fonts.ready.then(() => true)");
  await og.waitForTimeout(300);
  await og.screenshot({ path: path.join(ROOT, "images/og-image.png") });
  console.log("wrote images/og-image.png");

  await browser.close();
})();
