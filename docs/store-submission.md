# Chrome Web Store submission

Upload `howlonguntil-1.0.0.zip` as a **new item**. Do not upload it to the SimpleReview listing.

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

Five numbered marketing concepts have been sent for the owner's choice. They are illustrations, not screenshots of the installed extension. Final promotional artwork is pending that selection.

Store screenshots should show the actual extension: 1280×800 or 640×400, between one and five images. The small promotional tile is 440×280; the optional marquee is 1400×560. The packaged store icon is 128×128 PNG.

## Validation boundary

The automated suite verifies the production manifest's no-access default. Functional browser checks use the same JavaScript with a separate test-only manifest granting website access, because the headless browser cannot accept the native permission dialog. That modified manifest is never included in the release ZIP. Accept/cancel of the native prompt still needs a manual check.

A ZIP release is ready for upload; it is not a Chrome Web Store approval or public installation link.
