# Let's Rally Cincy

One-page site for Let's Rally Cincy, a free weekly night tennis rally in Cincinnati. Plain HTML/CSS/JS, no build step, GitHub Pages ready.

## Files

- **index.html** - The whole site: hero with the interactive rally, details strip, how it works, when & where, FAQ, and the join section
- **styles.css** - Design system (shares its bones with sglasgow.com) plus the hero layout and responsive rules
- **js/main.js** - Mobile menu and scroll reveals
- **js/rally.js** - The hero game. A canvas rally that plays itself until you move your mouse onto the court and take the near racket (touch: tap to swing). The far racket chases the ball at a capped speed, so placement wins points. Tuning knobs (gravity, racket reach, opponent speed, shot depth) live at the top of `layout()` and in `hit()`. Draws a single still frame under `prefers-reduced-motion`.
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
