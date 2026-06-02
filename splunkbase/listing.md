# Realtime Clock — Splunkbase listing copy

> Source of truth for the Splunkbase listing fields. Keep in sync with each release.
> Compatibility: Splunk Enterprise 9.0+ or Splunk Cloud with Dashboard Studio.

## Short Description (max 380 chars)

Two animated clock visualizations for Splunk Dashboard Studio: a smooth **analog** clock face (with optional digital readout) and a seven-segment **digital** LCD clock. Timezone-aware, themable colours, optional phosphor glow. No data required — drop one on any dashboard for a live, always-current clock.

## Summary (max 3000 chars)

Dashboard Studio has no built-in clock, yet operations walls, NOC status boards, world-clock panels and "as of now" headers all want a live, ticking time display. **Realtime Clock** adds two purpose-built custom visualizations that render the current time entirely client-side at 60fps — no streaming data, no scheduled searches, no backend.

**Analog Clock** — a smooth analog face with sweeping hands, tick marks, an optional digital readout and day/date line, and a configurable phosphor glow. Hand, second-hand and tick colours are all configurable.

**Digital Clock** — a seven-segment LCD-style display with a blinking colon, 12/24-hour modes, optional seconds, a date line, ghost (unlit) segments for an authentic LCD look, and a phosphor glow.

Both support **local time, UTC, or any IANA timezone** (e.g. `Europe/London`, `America/New_York`, `Asia/Tokyo`), so a single dashboard can show a row of world clocks. Because the time is computed in the browser, the clocks stay accurate to the second regardless of search refresh intervals.

Built as standard `studio_visualization` custom viz, themable to light/dark, and dependency-free.

## Details

After installing, both visualizations appear in the Dashboard Studio visualization picker under **Custom**.

1. Edit a Dashboard Studio dashboard → **Add chart** → choose **Analog Clock** or **Digital Clock**.
2. The viz needs no real data — it ships a no-op data source (`| makeresults | eval _time=now()`); leave it as-is.
3. Open the **Configuration** panel to set options.

**Analog Clock options:** `handColor`, `secondHandColor`, `tickColor`, `showDigital` (digital readout under the face), `showDate`, `showGlow`, `timezone`.

**Digital Clock options:** `color`, `background`, `timezone`, `hour24`, `showSeconds`, `showDate`, `showGlow`, `blinkColon`, `ghostSegments`.

Tip: place several copies side-by-side, each with a different `timezone`, for a world-clock board.

## Installation

1. Install the app (Apps → Manage Apps → Install app from file, or from Splunkbase).
2. Refresh Splunk Web (no full restart required for a custom visualization).
3. The clocks appear in the Dashboard Studio "Add chart" → Custom list.

Works on Splunk Enterprise (on-prem) and Splunk Cloud.

## Troubleshooting

- **Clock doesn't appear in the picker:** hard-refresh the browser; confirm the app is enabled and you're using **Dashboard Studio** (not Classic/SimpleXML).
- **Wrong time shown:** check the `timezone` option — `local` uses the viewer's browser timezone; set an explicit IANA name for a fixed zone.
- **No animation / static face:** ensure the panel has a non-trivial height and the browser tab is active (animation pauses in background tabs).
- **Colours look off in light mode:** set explicit colour options; defaults are tuned for dark dashboards.
