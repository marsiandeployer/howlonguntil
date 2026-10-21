# Chrome Web Store submission

Chrome Web Store item `mohifgpdnndhefjpkaacmnoadbphmmgl` was submitted for review on October 21, 2026, with package `howlonguntil-1.0.1.zip`. The dashboard showed “Ожидает рассмотрения” after reload. Automatic publication after approval was selected in the confirmation dialog. This is not yet an approval or a publicly installable release. Do not create another item or upload over SimpleReview.

Use the title and descriptions in `store/listing.en.txt`. The extension is free; its planned paid reminders are labelled “Pro — Soon” and are unavailable in this release.

- Source and support: https://github.com/marsiandeployer/howlonguntil
- Privacy policy: https://marsiandeployer.github.io/howlonguntil/privacy.html
- Single purpose: identify explicitly zoned times in permitted page text and show a local conversion and countdown.
- `storage`: keep local enable/disable preferences, excluded website origins, target time zone, clock format and abbreviation overrides.
- `scripting` and optional HTTP/HTTPS access: inject packaged highlighting code on pages after the user enables website access. Scanning must work across arbitrary websites rather than one predetermined domain.
- Remote code: none. JavaScript, styles, images and dependencies are bundled in the ZIP.
- Data handling: page text is processed transiently on the device. The extension does not collect or transmit user data. Only preferences are stored locally.

## Reviewer path

1. Install the extension, open an ordinary HTTPS page containing `18:00 UTC`, then click its toolbar icon.
2. Enable **Highlight event times** and accept Chrome's website-access prompt.
3. Hover over the underlined time. Expect a countdown, local date/time, original time zone and the assumed date when no date was provided.
4. Turn off the site switch. Expect highlights to disappear from that website.
5. Open Preferences to change the target time zone or abbreviation defaults.

Browser-internal pages and editable or code fields are excluded. No account or login is needed. The system time zone is used by default.

## Store artwork

The owner selected concept 04. The 440×280 and 1400×560 promotional illustrations, packaged 128×128 icon, and two actual 1280×800 extension screenshots were uploaded and verified after reload. Final artwork and generation prompts are in `store/artwork/`; real captures and their capture conditions are in `store/screenshots/`.

Store screenshots should show the actual extension: 1280×800 or 640×400, between one and five images. The small promotional tile is 440×280; the optional marquee is 1400×560. The packaged store icon is 128×128 PNG.

## Validation boundary

All 20 Node tests and 13 headless browser checks pass. Headless functional checks use byte-identical runtime JavaScript with a separate host-pregranted test manifest, which is never shipped. Fresh headed Chrome checks also pass against the unchanged production manifest: Deny leaves access and highlighting off; Allow grants both HTTP and HTTPS access and highlights the already-open page after Chrome closes the toolbar popup. This first-enable path was fixed in 1.0.1 before submission. Results are in `qa/native-permission-*-results.json`.

The current ZIP is 1.0.1; 1.0.0 is superseded. ZIP SHA-256: `a1e73e52c6749dff80023cab0b477d51e87fde253b9cc04d4490922de2c5cd1f`. Reviewer demo: https://marsiandeployer.github.io/howlonguntil/demo.html .
