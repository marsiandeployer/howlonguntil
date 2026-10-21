# How Long Until — Time Highlighter

Automatically find zoned times on a web page and hover to see a live countdown and your local date and time.

The extension runs locally. Its code and dependencies ship in the ZIP; it does not load remote code, collect analytics, or send page text to a server. Only preferences are saved locally.

## Development

```sh
npm ci
npm test
npm run build
npm run check:package
npm run test:browser
```

Load `dist/` through Chrome's **Extensions → Developer mode → Load unpacked**. Click the extension icon and enable highlighting to grant website access. Global and per-site switches control scanning.

## Time assumptions

An undated time refers to its next occurrence; the tooltip shows the assumed date. Explicit past dates show elapsed time. EST and PST are literal fixed offsets; ET and PT follow daylight saving. CST defaults to US Central Standard Time and IST to India; settings allow overrides.

Fields you edit, code samples, hidden text, browser-internal pages, closed shadow roots, and canvas content are excluded. The first release recognizes supported explicit time-zone formats, not arbitrary natural-language dates.

**Reminders · Pro — Soon** marks a planned paid feature. Version 1 does not include reminders, billing, accounts, or notification permissions.

## Release

This is a new product. Its Chrome Web Store item is separate from SimpleReview. A ZIP build or review submission does not mean public availability. Selected store-marketing direction is concept 04: calm blue editorial desk, pale paper, deep navy typography, and cyan time underline. The promo tile and marquee are uploaded and read back.

## License

MIT. Included third-party libraries retain their respective licenses.
