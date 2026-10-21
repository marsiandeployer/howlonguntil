# How Long Until

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Approved implementation plan: standalone Chrome Manifest V3 extension, JavaScript ES modules, packaged time-zone support, local Node build and browser tests. No backend.

## Users
People reading event announcements, meeting times, release schedules, and status pages in time zones other than their own.

## Product Purpose
Automatically underline an event time in page text. Hover to see how long until it happens, its local date/time, and the source time zone.

## Operating Context
Ordinary HTTP/HTTPS pages, including dynamically inserted content. The browser supplies the user's current time zone. A single first-use permission enables scanning across websites; users can disable individual sites.

## Capabilities and Constraints
- Product name: How Long Until — Time Highlighter.
- Free automatic highlighting and live countdown. Past dated events show elapsed time.
- For an undated time, use its next occurrence and show the assumed date.
- UTC/GMT, explicit offsets, ISO timestamps and common time-zone abbreviations. CST defaults to US Central standard time, IST to India, BST to UK summer time; overrides are editable.
- All code, libraries, styles and assets ship in the extension. No remote code, telemetry, account, payment, or page-text transmission.
- Open-source MIT repository. Local-only preferences.
- Reminders will be paid; v1 shows the disabled label “Reminders · Pro — Soon”.
- Selected store-marketing direction: concept 04, calm blue editorial desk, pale paper, deep navy typography, and cyan time underline. Promo tile and marquee are uploaded and read back.

## Brand Commitments
Use “How long until” in the store title and realistic use cases. Explain privacy with verifiable claims: “Runs locally. No remote code. Open source.” Do not claim automatic highlighting is unique or guarantee absolute safety.

## Evidence on Hand
Semrush US keyword research from 2026-10-21 in the Habab project. Chrome Web Store search enumerated 447 cards; selected direct competitors' descriptions were reviewed, not installed. Existing publication example is SimpleReview in `/root/aisell/extensions/simple_review`; its item ID must never be reused.

## Product Principles
- Lead with the time remaining.
- Preserve the page's original wording and layout.
- Make source-zone assumptions visible.
- Keep page content on the user's device.

## Accessibility & Inclusion
Readable light/dark surfaces, clear focus states, keyboard-accessible found-time list, reduced-motion support. First release interface and listing are English.
