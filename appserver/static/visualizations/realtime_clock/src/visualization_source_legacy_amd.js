/*
 * Realtime Clock — Splunk Custom Visualization
 *
 * Renders an analog clock on an HTML5 Canvas using requestAnimationFrame.
 * Aesthetic matches the AirspaceWatch dashboard (dark face, teal accents).
 *
 * The visualization is technically driven by a Splunk search
 * (`| makeresults | eval _time=now() | table _time`) so it conforms to the
 * SplunkVisualizationBase contract, but the displayed time is sourced from
 * `Date.now()` so the second hand sweeps smoothly without re-running the
 * search every tick.
 *
 * Formatting properties (exposed via visualizations.conf format menu / the
 * Dashboard Studio "Configuration" panel):
 *   - clockFaceColor   (color, default #050810)
 *   - handColor        (color, default #6aa3f8)
 *   - secondHandColor  (color, default #00d4aa)
 *   - tickColor        (color, default #00d4aa)
 *   - showDigital      (bool,  default true)
 *   - timezone         (enum,  "local" | "utc", default "local")
 *   - showDate         (bool,  default true)
 *   - showGlow         (bool,  default true)
 *
 * Build:
 *   npm install
 *   npm run build
 *
 * Output: ../visualization.js (consumed by Splunk)
 */

define([
    'jquery',
    'underscore',
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils'
], function ($, _, SplunkVisualizationBase, vizUtils) {
    'use strict';

    // -----------------------------------------------------------------------
    // Defaults — mirror the AirspaceWatch palette
    // -----------------------------------------------------------------------
    var DEFAULTS = {
        clockFaceColor: '#050810',
        handColor: '#6aa3f8',
        secondHandColor: '#00d4aa',
        tickColor: '#00d4aa',
        showDigital: true,
        timezone: 'local',
        showDate: true,
        showGlow: true
    };

    // Helper — coerce Splunk's stringy booleans
    function asBool(value, fallback) {
        if (value === undefined || value === null || value === '') {
            return fallback;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        var v = String(value).toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    return SplunkVisualizationBase.extend({

        // -------------------------------------------------------------------
        // Lifecycle
        // -------------------------------------------------------------------
        initialize: function () {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);

            this.$el = $(this.el);
            this.$el.addClass('viz-realtime-clock');

            // State
            this._animFrame = null;
            this._dpr = window.devicePixelRatio || 1;
            this._canvas = null;
            this._digital = null;
            this._dateEl = null;
            this._lastSize = { w: 0, h: 0 };
            this._serverTimeOffsetMs = 0;   // (server_time - client_time)
        },

        // We do not need data to render — but keep the contract.
        getInitialDataParams: function () {
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 1
            };
        },

        // -------------------------------------------------------------------
        // Format the data Splunk hands us. We don't transform much — just
        // capture the server's _time so we can compute an offset (handy when
        // the browser clock drifts from the Splunk indexer).
        // -------------------------------------------------------------------
        formatData: function (data) {
            if (data && data.rows && data.rows.length > 0) {
                var raw = data.rows[0][0];
                var serverTs = parseFloat(raw);
                if (!isNaN(serverTs)) {
                    // Splunk _time is epoch seconds
                    var serverMs = serverTs * 1000;
                    this._serverTimeOffsetMs = serverMs - Date.now();
                }
            }
            return data;
        },

        // -------------------------------------------------------------------
        // Main render — called by Splunk on data load + on config change.
        // -------------------------------------------------------------------
        updateView: function (data, config) {
            var opts = this._readConfig(config);

            // (Re)build DOM the first time, or after a teardown.
            if (!this._canvas) {
                this._buildDom(opts);
            } else {
                this._applyContainerStyles(opts);
            }

            // Kick off the animation loop (idempotent — _loop checks itself).
            this._startLoop(opts);
        },

        // Splunk calls this when the visualization area resizes.
        reflow: function () {
            this._resizeCanvas();
        },

        // Splunk calls this on teardown / re-render.
        remove: function () {
            this._stopLoop();
            if (this.$el) {
                this.$el.empty();
            }
            this._canvas = null;
            this._digital = null;
            this._dateEl = null;
        },

        // -------------------------------------------------------------------
        // Internal — config
        // -------------------------------------------------------------------
        _readConfig: function (config) {
            config = config || {};
            var ns = this.getPropertyNamespaceInfo().propertyNamespace;
            var get = function (key) {
                return config[ns + key];
            };

            return {
                clockFaceColor:  get('clockFaceColor')  || DEFAULTS.clockFaceColor,
                handColor:       get('handColor')       || DEFAULTS.handColor,
                secondHandColor: get('secondHandColor') || DEFAULTS.secondHandColor,
                tickColor:       get('tickColor')       || DEFAULTS.tickColor,
                showDigital:     asBool(get('showDigital'),  DEFAULTS.showDigital),
                timezone:        (get('timezone') || DEFAULTS.timezone).toLowerCase(),
                showDate:        asBool(get('showDate'),     DEFAULTS.showDate),
                showGlow:        asBool(get('showGlow'),     DEFAULTS.showGlow)
            };
        },

        // -------------------------------------------------------------------
        // Internal — DOM
        // -------------------------------------------------------------------
        _buildDom: function (opts) {
            this.$el.empty();

            this.$container = $('<div class="rtc-container"></div>').appendTo(this.$el);
            this.$canvasWrap = $('<div class="rtc-canvas-wrap"></div>').appendTo(this.$container);
            this._canvas = document.createElement('canvas');
            this._canvas.className = 'rtc-canvas';
            this.$canvasWrap.append(this._canvas);

            this.$digitalWrap = $('<div class="rtc-digital-wrap"></div>').appendTo(this.$container);
            this._digital = document.createElement('div');
            this._digital.className = 'rtc-digital';
            this.$digitalWrap.append(this._digital);

            this._dateEl = document.createElement('div');
            this._dateEl.className = 'rtc-date';
            this.$digitalWrap.append(this._dateEl);

            this._applyContainerStyles(opts);
            this._resizeCanvas();
        },

        _applyContainerStyles: function (opts) {
            this.$el.css({
                width: '100%',
                height: '100%',
                background: opts.clockFaceColor,
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'font-family': '"SF Mono", "Roboto Mono", Menlo, Consolas, monospace',
                color: opts.handColor,
                overflow: 'hidden'
            });
            this.$container.css({
                width: '100%',
                height: '100%',
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                'justify-content': 'center',
                padding: '8px',
                'box-sizing': 'border-box'
            });
            this.$canvasWrap.css({
                flex: '1 1 auto',
                width: '100%',
                'min-height': '0',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center'
            });
            this.$digitalWrap.css({
                flex: '0 0 auto',
                display: opts.showDigital || opts.showDate ? 'flex' : 'none',
                'flex-direction': 'column',
                'align-items': 'center',
                gap: '2px',
                'margin-top': '6px'
            });
            $(this._digital).css({
                display: opts.showDigital ? 'block' : 'none',
                'font-size': '16px',
                'font-weight': '600',
                color: opts.secondHandColor,
                'letter-spacing': '2px',
                'text-shadow': opts.showGlow ? '0 0 8px ' + opts.secondHandColor : 'none'
            });
            $(this._dateEl).css({
                display: opts.showDate ? 'block' : 'none',
                'font-size': '11px',
                color: opts.handColor,
                opacity: '0.7',
                'letter-spacing': '1px'
            });
        },

        _resizeCanvas: function () {
            if (!this._canvas || !this.$canvasWrap) {
                return;
            }
            var wrap = this.$canvasWrap[0];
            var w = wrap.clientWidth  || 300;
            var h = wrap.clientHeight || 300;
            var size = Math.max(40, Math.min(w, h));

            if (this._lastSize.w === size && this._lastSize.h === size) {
                return;
            }
            this._lastSize = { w: size, h: size };

            this._dpr = window.devicePixelRatio || 1;
            this._canvas.width  = Math.round(size * this._dpr);
            this._canvas.height = Math.round(size * this._dpr);
            this._canvas.style.width  = size + 'px';
            this._canvas.style.height = size + 'px';
        },

        // -------------------------------------------------------------------
        // Internal — animation loop
        // -------------------------------------------------------------------
        _startLoop: function (opts) {
            this._opts = opts;
            if (this._animFrame) {
                return; // already running
            }
            var self = this;
            var loop = function () {
                self._draw();
                self._animFrame = window.requestAnimationFrame(loop);
            };
            this._animFrame = window.requestAnimationFrame(loop);
        },

        _stopLoop: function () {
            if (this._animFrame) {
                window.cancelAnimationFrame(this._animFrame);
                this._animFrame = null;
            }
        },

        // -------------------------------------------------------------------
        // Internal — drawing
        // -------------------------------------------------------------------
        _now: function () {
            return new Date(Date.now() + (this._serverTimeOffsetMs || 0));
        },

        _draw: function () {
            if (!this._canvas) return;
            this._resizeCanvas();

            var ctx = this._canvas.getContext('2d');
            var size = this._canvas.width;     // in device pixels
            var dpr = this._dpr;
            var cssSize = size / dpr;
            var opts = this._opts || DEFAULTS;

            // Clear
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

            // Scale for HiDPI and recentre on the css coordinate system
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var cx = cssSize / 2;
            var cy = cssSize / 2;
            var radius = (cssSize / 2) - 8;

            this._drawFace(ctx, cx, cy, radius, opts);
            this._drawTicks(ctx, cx, cy, radius, opts);
            this._drawNumerals(ctx, cx, cy, radius, opts);
            this._drawHands(ctx, cx, cy, radius, opts);

            ctx.restore();

            this._updateDigital(opts);
        },

        _drawFace: function (ctx, cx, cy, radius, opts) {
            // Outer ring — subtle
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.fillStyle = opts.clockFaceColor;
            ctx.fill();

            // Faint inner gradient halo
            var grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
            grad.addColorStop(0, 'rgba(0, 212, 170, 0.05)');
            grad.addColorStop(1, 'rgba(0, 212, 170, 0)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Bezel
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.lineWidth = Math.max(1, radius * 0.018);
            ctx.strokeStyle = this._hexToRgba(opts.tickColor, 0.35);
            ctx.stroke();

            // Inner thin ring at ~0.92 R
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.92, 0, 2 * Math.PI);
            ctx.lineWidth = 1;
            ctx.strokeStyle = this._hexToRgba(opts.tickColor, 0.18);
            ctx.stroke();
        },

        _drawTicks: function (ctx, cx, cy, radius, opts) {
            var i;
            // 60 minute ticks
            for (i = 0; i < 60; i++) {
                var angle = (i * Math.PI) / 30 - Math.PI / 2;
                var isHour = i % 5 === 0;
                var inner = isHour ? radius * 0.84 : radius * 0.88;
                var outer = radius * 0.94;
                var x1 = cx + Math.cos(angle) * inner;
                var y1 = cy + Math.sin(angle) * inner;
                var x2 = cx + Math.cos(angle) * outer;
                var y2 = cy + Math.sin(angle) * outer;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineWidth = isHour ? Math.max(1.5, radius * 0.016) : 1;
                ctx.strokeStyle = isHour
                    ? opts.tickColor
                    : this._hexToRgba(opts.tickColor, 0.45);
                ctx.stroke();
            }
        },

        _drawNumerals: function (ctx, cx, cy, radius, opts) {
            // Numerals are only legible when there's room — skip when tiny.
            if (radius < 60) return;

            ctx.fillStyle = this._hexToRgba(opts.handColor, 0.75);
            ctx.font = (Math.max(10, radius * 0.11)).toFixed(0) +
                'px "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (var h = 1; h <= 12; h++) {
                var angle = (h * Math.PI) / 6 - Math.PI / 2;
                var nx = cx + Math.cos(angle) * (radius * 0.74);
                var ny = cy + Math.sin(angle) * (radius * 0.74);
                ctx.fillText(String(h), nx, ny);
            }
        },

        _drawHands: function (ctx, cx, cy, radius, opts) {
            var now = this._now();
            var useUtc = opts.timezone === 'utc';

            var hours   = useUtc ? now.getUTCHours()        : now.getHours();
            var minutes = useUtc ? now.getUTCMinutes()      : now.getMinutes();
            var seconds = useUtc ? now.getUTCSeconds()      : now.getSeconds();
            var ms      = useUtc ? now.getUTCMilliseconds() : now.getMilliseconds();

            var hourAngle   = ((hours % 12) + minutes / 60 + seconds / 3600) * (Math.PI / 6) - Math.PI / 2;
            var minuteAngle = (minutes + seconds / 60) * (Math.PI / 30) - Math.PI / 2;
            // Smooth (sub-second) sweep on the second hand
            var secondAngle = (seconds + ms / 1000) * (Math.PI / 30) - Math.PI / 2;

            // Hour hand — chunky
            this._drawHand(ctx, cx, cy,
                radius * 0.50, Math.max(3, radius * 0.045),
                hourAngle, opts.handColor, opts.showGlow ? opts.handColor : null, 6);

            // Minute hand — slimmer, longer
            this._drawHand(ctx, cx, cy,
                radius * 0.72, Math.max(2, radius * 0.030),
                minuteAngle, opts.handColor, opts.showGlow ? opts.handColor : null, 4);

            // Second hand — accent colour, with a tail
            this._drawSecondHand(ctx, cx, cy, radius, secondAngle, opts);

            // Centre cap
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(3, radius * 0.04), 0, 2 * Math.PI);
            ctx.fillStyle = opts.secondHandColor;
            ctx.shadowColor = opts.showGlow ? opts.secondHandColor : 'transparent';
            ctx.shadowBlur = opts.showGlow ? 10 : 0;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1.5, radius * 0.018), 0, 2 * Math.PI);
            ctx.fillStyle = opts.clockFaceColor;
            ctx.fill();
        },

        _drawHand: function (ctx, cx, cy, length, width, angle, color, glowColor, glowBlur) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            if (glowColor) {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = glowBlur;
            }

            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineWidth = width;
            ctx.strokeStyle = color;
            ctx.moveTo(-width * 0.5, 0);
            ctx.lineTo(length, 0);
            ctx.stroke();

            ctx.restore();
        },

        _drawSecondHand: function (ctx, cx, cy, radius, angle, opts) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            if (opts.showGlow) {
                ctx.shadowColor = opts.secondHandColor;
                ctx.shadowBlur = 12;
            }

            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(1.2, radius * 0.014);
            ctx.strokeStyle = opts.secondHandColor;
            // tail behind centre, main body in front
            ctx.moveTo(-radius * 0.18, 0);
            ctx.lineTo(radius * 0.86, 0);
            ctx.stroke();

            // tip dot
            ctx.beginPath();
            ctx.arc(radius * 0.86, 0, Math.max(2, radius * 0.022), 0, 2 * Math.PI);
            ctx.fillStyle = opts.secondHandColor;
            ctx.fill();

            ctx.restore();
        },

        // -------------------------------------------------------------------
        // Internal — digital / date display
        // -------------------------------------------------------------------
        _updateDigital: function (opts) {
            if (!this._digital) return;
            var now = this._now();
            var useUtc = opts.timezone === 'utc';

            if (opts.showDigital) {
                var hh = this._pad(useUtc ? now.getUTCHours()   : now.getHours());
                var mm = this._pad(useUtc ? now.getUTCMinutes() : now.getMinutes());
                var ss = this._pad(useUtc ? now.getUTCSeconds() : now.getSeconds());
                var suffix = useUtc ? ' UTC' : '';
                this._digital.textContent = hh + ':' + mm + ':' + ss + suffix;
            }

            if (opts.showDate) {
                var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                var days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
                var d = useUtc ? now.getUTCDate()       : now.getDate();
                var m = useUtc ? now.getUTCMonth()      : now.getMonth();
                var y = useUtc ? now.getUTCFullYear()   : now.getFullYear();
                var wd = useUtc ? now.getUTCDay()       : now.getDay();
                this._dateEl.textContent = days[wd] + ' ' + this._pad(d) + ' ' + months[m] + ' ' + y;
            }
        },

        _pad: function (n) {
            return (n < 10 ? '0' : '') + n;
        },

        // -------------------------------------------------------------------
        // Helpers
        // -------------------------------------------------------------------
        _hexToRgba: function (hex, alpha) {
            if (!hex) return 'rgba(0, 212, 170, ' + alpha + ')';
            var h = hex.replace('#', '');
            if (h.length === 3) {
                h = h.split('').map(function (c) { return c + c; }).join('');
            }
            var r = parseInt(h.substring(0, 2), 16);
            var g = parseInt(h.substring(2, 4), 16);
            var b = parseInt(h.substring(4, 6), 16);
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                return 'rgba(0, 212, 170, ' + alpha + ')';
            }
            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
        }
    });
});
