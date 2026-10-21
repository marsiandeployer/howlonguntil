---
name: How Long Until — Time Highlighter
description: A compact, countdown-first interface for local time-zone highlighting.
colors:
  surface: "#fffefa"
  surface-soft: "#f5f3ef"
  ink: "#23212a"
  muted: "#696671"
  line: "#e7e4e0"
  accent: "#6554b8"
  accent-strong: "#493b91"
  focus: "#5746af"
  good: "#36745d"
  warning: "#76551d"
  toggle-muted: "#aaa6ae"
  page-underline: "#8062b8"
  surface-dark: "#211f24"
  surface-soft-dark: "#2b2930"
  ink-dark: "#f3f0f6"
  muted-dark: "#bcb7c3"
  line-dark: "#403d46"
  accent-dark: "#b5a6ff"
  accent-strong-dark: "#d0c7ff"
  focus-dark: "#c3b8ff"
  good-dark: "#9bd3b5"
  warning-dark: "#f0c97d"
  tooltip-surface-dark: "#25212b"
  tooltip-countdown: "#4e347c"
  tooltip-countdown-dark: "#c8b2f4"
  tooltip-muted: "#625b6d"
  tooltip-muted-dark: "#c2b9cd"
  tooltip-ink: "#211d27"
  tooltip-ink-dark: "#f4f0f7"
typography:
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  section-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 680
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
  countdown:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.15
rounded:
  control: "5px"
  notice: "6px"
  pill: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  toggle-off:
    backgroundColor: "{colors.toggle-muted}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "3px"
    width: "44px"
    height: "26px"
  toggle-on:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "3px"
    width: "44px"
    height: "26px"
  event-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 8px"
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 8px"
    height: "31px"
  notice:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.notice}"
    padding: "8px 10px"
---

# Design System: How Long Until — Time Highlighter

## Overview

**Creative North Star: Concept 04, Calm Blue Editorial Desk.** Store marketing uses a calm blue desk, pale paper, deep navy typography, a restrained cyan time underline, soft daylight, and quiet human context. This selected marketing identity is separate from the utility interface, which remains the warm-white and violet system currently implemented below.

The extension popup is compact, quiet, readable, and countdown-first. It uses warm white surfaces, deep ink, and restrained violet accents. The page itself keeps its wording and layout; supported times receive a fine violet underline, with details shown in a small floating tooltip. Light and dark appearance follow the operating system. Store artwork uses the selected blue editorial direction and is promotional illustration rather than a product screenshot.

**Key Characteristics:**
- Compact utility surface with a fixed 380px popup width.
- System UI typography and tabular countdown numerals.
- Warm neutral surfaces, ink text, and violet action/highlight color.
- Minimal borders and state feedback; no decorative gradients.
- Store marketing uses pale paper, calm blue, navy type, and a cyan time underline, following selected concept 04.

## Colors

The popup's light palette is warm white and charcoal with violet for active controls and links; dark mode swaps the same roles to a charcoal surface and pale text. The page tooltip has its own slightly warmer dark surface.

### Utility interface
- **Restrained violet** (`accent`): toggle-on state and the time-highlight underline; dark mode uses its paired pale violet token.
- **Deep violet** (`accent-strong`): popup links and countdown emphasis.

### Neutral
- **Warm white** (`surface`): popup, inputs, event rows, and light tooltip.
- **Soft warm gray** (`surface-soft`): notice surfaces and hover rows.
- **Deep ink** (`ink`): primary text.
- **Muted gray** (`muted`): supporting text and labels.
- **Fine gray** (`line`): section separators and input borders.
- **Dark surface, soft surface, light ink, muted text, and divider** (`surface-dark`, `surface-soft-dark`, `ink-dark`, `muted-dark`, `line-dark`): corresponding roles in dark mode.

### Named Rules
**The Page-Preservation Rule.** Highlight the detected range with an underline while preserving the original wording and layout.

### Store marketing identity
Selected concept 04 uses a calm blue editorial desk, pale paper, deep navy typography, a restrained cyan underline, and soft daylight. These are store-art direction; the packaged utility UI continues to use the warm-white and violet tokens above.

## Typography

**Display Font:** System UI sans-serif stack (`system-ui`, Apple system, BlinkMacSystemFont, Segoe UI, sans-serif). No separate display face is used.
**Body Font:** The same system UI stack.
**Label/Mono Font:** System UI stack; countdowns use tabular numerals rather than a separate monospace face.

**Character:** Neutral and compact, with emphasis carried by weight, spacing, and numeric alignment rather than decorative type. Secondary popup text is 12px or larger; body copy is 14px.

### Hierarchy
- **Title** (700, 21px, 1.15 line-height): popup title.
- **Section title** (680, 14px): settings and section headings.
- **Body** (400, 14px): baseline inherited text size.
- **Label** (650–750, 12px): controls, field labels, status, and supporting copy; section labels may use 0.1em tracking and uppercase.
- **Countdown** (650, 25px, 1.15 line-height): dominant value in the page tooltip, with tabular numerals.

### Named Rules
**The Readable Utility Rule.** Keep secondary popup text at 12px or larger and body text at 14px; reserve smaller text for non-user-facing implementation details.

## Layout

The popup is a single 380px-wide column with 20px horizontal inset and 19px top inset. Sections stack vertically, separated by fine rules; detected times form a compact list with a 188px maximum scroll area. Preferences expand in place. The page tooltip is content-sized and constrained to the viewport, with its countdown first and local date/time directly below.

The popup has no responsive breakpoint because Chrome fixes its action popup viewport. The page tooltip adapts its width and placement to available viewport space.

## Elevation & Depth

The popup is mostly flat: separators, tonal surface shifts, and small state changes organize it. Shadows are limited to the toggle thumb, active indicator, and floating page tooltip; the tooltip shadow communicates that it overlays page content.

### Shadow Vocabulary
- **Control thumb** (`0 1px 2px #0003`): subtle separation of the white toggle thumb from its track.
- **Active indicator** (`0 0 0 3px` using a 15% success-color halo): small state cue beside the title.
- **Floating tooltip** (`0 8px 26px rgba(27, 20, 38, .15)` light; `0 8px 26px rgba(0, 0, 0, .4)` dark): keeps event detail legible over page content.

## Shapes

Popup fields and event rows use gently rounded corners (5px); notices are slightly rounder (6px). Toggle tracks are capsule-shaped (99px) with circular white thumbs. Dividers stay thin and square. The tooltip uses a larger soft corner (12px) to read as a floating surface.

## Components

### Toggle switches
Compact capsule tracks show the binary state through track color and thumb position. The main switch is 44×26px; the site switch is 36×22px. Focus uses a 3px outline with 3px offset; disabled controls reduce opacity and use a not-allowed cursor.

### Event rows
Each result is a full-width, transparent button with 9px 8px padding. Original text is left aligned and ellipsized; countdown is right aligned with tabular numerals; local date, time zone, and assumption occupy the next line. Hover uses the soft surface. Keyboard focus remains visible.

### Inputs and notices
Inputs have a 1px divider-colored border, surface background, 5px corners, and a 31px minimum height. Notices use the soft surface with warning-colored text, 6px corners, and compact padding.

### Page highlight and tooltip
Detected text receives a 1.5px violet underline with a small offset. Hover opens a shadowed tooltip with the source label, a 25px countdown, local date/time, source zone, and any date assumption. The tooltip has no decorative imagery.

### Reminders label
“Reminders · Pro — Soon” is a muted, non-interactive status row. It must remain visibly unavailable until the feature exists.

## Do's and Don'ts

### Do:
- **Do** preserve the current system UI stack, warm neutral surfaces, restrained violet states, and light/dark role pairing in the utility interface.
- **Do** use the selected concept 04 blue editorial desk, pale paper, navy type, and cyan time underline for store marketing artwork.
- **Do** use the countdown as the page tooltip's strongest typographic element and align changing numbers with tabular numerals.
- **Do** keep focus visible and secondary popup text at least 12px.
- **Do** treat the page underline and tooltip as overlays that leave source text and page structure intact.

### Don't:
- **Don't** apply the store-art blue and cyan palette to the utility interface without a separate UI design change.
- **Don't** add decorative gradients, dashboard-like panels, artificial world clocks, or invented activity to the extension UI.
- **Don't** make the future Reminders label look interactive or claim it is available.
