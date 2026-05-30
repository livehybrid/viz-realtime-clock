# viz-realtime-clock

A Splunk custom visualization that renders a **real-time analog clock** with
an aviation-grade dark aesthetic. Built for the
[AirspaceWatch Splunk Dashboard Contest 2026](https://www.splunk.com/) entry.

![Realtime Clock screenshot](appserver/static/visualizations/realtime_clock/preview.png)

## Features

- Smooth-sweep second hand driven by `requestAnimationFrame` (sub-second
  precision, never out of sync with the wall clock).
- Optional **digital time** and **date** display below the dial.
- **UTC** or **local browser timezone** rendering.
- All colours configurable (face, hour/minute hand, second hand, ticks).
- Optional neon glow on the second hand & centre cap.
- HiDPI / Retina aware (canvas resized to `devicePixelRatio`).
- Auto-resizes inside Dashboard Studio grid cells.

Default palette matches **AirspaceWatch**:

| Element              | Colour      |
| -------------------- | ----------- |
| Face                 | `#050810`   |
| Hour / minute hands  | `#6aa3f8`   |
| Second hand & ticks  | `#00d4aa`   |

## Repo layout

```
viz-realtime-clock/
├── app.manifest
├── default/
│   ├── app.conf
│   └── visualizations.conf
├── metadata/
│   └── default.meta
├── README/
│   ├── savedsearches.conf.spec
│   └── visualizations.conf.spec
├── appserver/static/visualizations/realtime_clock/
│   ├── src/
│   │   └── visualization_source.js     # main viz code
│   ├── visualization.js                # built output (shim by default)
│   ├── formatter.html                  # classic-viz formatter
│   ├── webpack.config.js
│   ├── package.json
│   └── .babelrc
└── README.md
```

## Build

```bash
cd appserver/static/visualizations/realtime_clock
npm install
npm run build
```

This produces a single Babel-transpiled, AMD-wrapped bundle at
`visualization.js`, ready for Splunk to pick up via RequireJS.

> The repo also ships with a tiny `visualization.js` **shim** that defers to
> `src/visualization_source.js` directly. That means the viz will *load* even
> before you run the build — handy for local iteration. Always run `npm run
> build` before packaging for SplunkBase.

## Install in Splunk

### Option A — drop in `$SPLUNK_HOME/etc/apps/`

```bash
# from the repo root
rsync -a apps/viz-realtime-clock/ $SPLUNK_HOME/etc/apps/viz-realtime-clock/
$SPLUNK_HOME/bin/splunk restart
```

### Option B — package & upload

```bash
cd apps
tar --exclude='node_modules' --exclude='*.tgz' \
    -czf viz-realtime-clock-1.0.0.tar.gz viz-realtime-clock
```

Then upload via **Manage Apps → Install app from file** in Splunk Web.

Run **Splunk AppInspect** before uploading to SplunkBase:

```bash
splunk-appinspect inspect viz-realtime-clock-1.0.0.tar.gz \
    --mode precert --included-tags cloud
```

## Use in a Dashboard Studio dashboard

In the dashboard definition JSON (or via the UI: **Add → Custom → Realtime
Clock**) reference the viz by its fully-qualified ID:

```json
{
    "visualizations": {
        "clock_viz_1": {
            "type": "splunk.viz-realtime-clock.realtime_clock",
            "title": "Local Time",
            "dataSources": {
                "primary": "clock_ds"
            },
            "options": {
                "clockFaceColor": "#050810",
                "handColor": "#6aa3f8",
                "secondHandColor": "#00d4aa",
                "tickColor": "#00d4aa",
                "showDigital": true,
                "showDate": true,
                "showGlow": true,
                "timezone": "local"
            }
        }
    },
    "dataSources": {
        "clock_ds": {
            "type": "ds.search",
            "options": {
                "query": "| makeresults | eval _time=now() | table _time",
                "queryParameters": { "earliest": "-1m", "latest": "now" }
            }
        }
    }
}
```

The search is intentionally trivial — the viz drives its own animation off
`Date.now()`. The `_time` returned by Splunk is only used to compute a
clock-skew offset (so a wildly wrong client clock won't lie to the viewer).

## Classic SimpleXML usage

```xml
<viz type="viz-realtime-clock.realtime_clock">
    <search>
        <query>| makeresults | eval _time=now() | table _time</query>
        <refresh>60s</refresh>
    </search>
    <option name="viz-realtime-clock.realtime_clock.timezone">utc</option>
    <option name="viz-realtime-clock.realtime_clock.showDate">true</option>
</viz>
```

## Formatting properties

See [`README/visualizations.conf.spec`](README/visualizations.conf.spec) for
the authoritative list. Quick reference:

| Property          | Type      | Default     | Notes                              |
| ----------------- | --------- | ----------- | ---------------------------------- |
| `clockFaceColor`  | color     | `#050810`   | Background of the dial             |
| `handColor`       | color     | `#6aa3f8`   | Hour & minute hands                |
| `secondHandColor` | color     | `#00d4aa`   | Second hand + centre cap           |
| `tickColor`       | color     | `#00d4aa`   | Tick marks                         |
| `showDigital`     | boolean   | `true`      | Show `HH:MM:SS` under the dial     |
| `showDate`        | boolean   | `true`      | Show `WED 21 May 2026`             |
| `showGlow`        | boolean   | `true`      | Neon glow on the second hand       |
| `timezone`        | dropdown  | `local`     | `local` or `utc`                   |

## Development tips

- The viz code is pure ES5 — no framework, no JSX, no async. Easiest possible
  surface area for Splunk's AMD/RequireJS loader.
- Open browser devtools while a panel is selected — any thrown errors will
  appear there, not in `splunkd.log`.
- If you change `visualizations.conf` you must **restart Splunk** (or `debug/refresh`).
- If the viz panel stays blank: hard-refresh the browser to bust the static
  asset cache (`appserver/static/` is aggressively cached).

## License

Apache 2.0.

## Credits

- Built for the **AirspaceWatch** entry to the Splunk Dashboard Contest 2026.
- Scaffold inspired by [rcastley/splunk-custom-visualizations](https://github.com/rcastley/splunk-custom-visualizations).
