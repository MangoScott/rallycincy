# Let's Rally Cincy

One-page site for Let's Rally Cincy, a free weekly night tennis rally in Cincinnati. Plain HTML/CSS/JS, no build step, GitHub Pages ready.

## Files

- **index.html** - The whole site: hero with the CSS rally animation, details strip, how it works, when & where, FAQ, and the join section
- **styles.css** - Design system (shares its bones with sglasgow.com) plus the rally animation and responsive rules
- **js/main.js** - Mobile menu, scroll reveals, and the hover/tap speed-up on the rally
- **logo.svg** - The ball mark. **logo-wordmark.svg** - Mark plus wordmark for social bios, flyers, etc. **favicon.svg** - Mark on a night-sky tile
- **favicon-32x32.png, apple-touch-icon.png, icon-192.png, icon-512.png, images/og-image.png** - Rendered from the SVGs and `tools/og-card.html` by `tools/render.js`
- **site.webmanifest** - PWA manifest

## Editing the details

Day, time, and meeting-point copy appear in three places in `index.html`: the hero meta line, the details strip, and the "When & where" list. Search for `Thursday` and `7:30` to find them all.

Links to fill in:

- Instagram: every `href="https://www.instagram.com/"` should point at the account
- Contact: the `mailto:` in the join section
- Domain: once live, add `og:url`, `twitter:url`, and a `link rel="canonical"` tag, and make the `og:image` URL absolute

## Photos

The "When & where" section has a photo slot (`.media-slot`). Drop an `<img>` inside it in place of the court-lines SVG and the dark background gives way. The "How it works" cards also accept a `.card-image-wrapper` at the top, styled the same way as the personal site (grayscale until hover).

## Re-rendering icons and the social card

```
npm i -g playwright && npx playwright install chromium   # once
node tools/render.js
```

## Deployment

Push to `main` and enable GitHub Pages on the repository root. Add a `CNAME` file if a custom domain is used.
