/*
 * Realtime Clock — Splunk Dashboard Studio studio_visualization
 *
 * Draws an animated analog clock face + optional digital readout on a canvas.
 * Runs at ~60 fps via requestAnimationFrame.
 *
 * Options (all editable in Studio Configuration panel via config.json):
 *   clockFaceColor  (string, default '#050810')  Canvas background
 *   handColor       (string, default '#6aa3f8')  Hour / minute hands
 *   secondHandColor (string, default '#00d4aa')  Second hand + accents
 *   tickColor       (string, default '#00d4aa')  Tick marks + ring
 *   showDigital     (boolean, default true)       HH:MM:SS below face
 *   showDate        (boolean, default true)       Day/date below digital
 *   showGlow        (boolean, default true)       Phosphor glow on hands
 *   timezone        (string,  default 'local')    'local', 'utc', or IANA
 *                                                  e.g. 'Europe/London'
 */
(function () {
    'use strict';

    var FACE_COLOR = '#050810';

    var DEFAULTS = {
        handColor:       '#6aa3f8',
        secondHandColor: '#00d4aa',
        tickColor:       '#00d4aa',
        showDigital:     true,
        showDate:        true,
        showGlow:        true,
        timezone:        'local',
    };

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function hexToRgba(hex, alpha) {
        if (!hex) return 'rgba(0,212,170,' + alpha + ')';
        var h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        var r = parseInt(h.substring(0,2),16),
            g = parseInt(h.substring(2,4),16),
            b = parseInt(h.substring(4,6),16);
        if (isNaN(r)||isNaN(g)||isNaN(b)) return 'rgba(0,212,170,' + alpha + ')';
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    /*
     * Extract h/m/s/ms/d/mo/yr/dow for the current moment in the given timezone.
     * Supports 'local', 'utc', and any IANA timezone name (e.g. 'Europe/London').
     * Falls back to local on invalid timezone strings.
     */
    function getTimeComponents(tz) {
        var now = new Date();
        var t   = (tz || 'local').trim();

        if (t === 'local') {
            return {
                h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(),
                ms: now.getMilliseconds(),
                d: now.getDate(), mo: now.getMonth(), yr: now.getFullYear(),
                dow: now.getDay(), label: '',
            };
        }
        if (t === 'utc' || t === 'UTC') {
            return {
                h: now.getUTCHours(), m: now.getUTCMinutes(), s: now.getUTCSeconds(),
                ms: now.getUTCMilliseconds(),
                d: now.getUTCDate(), mo: now.getUTCMonth(), yr: now.getUTCFullYear(),
                dow: now.getUTCDay(), label: 'UTC',
            };
        }
        /* IANA timezone via Intl.DateTimeFormat */
        try {
            var fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: t,
                year: 'numeric', month: 'numeric', day: 'numeric',
                weekday: 'short',
                hour: 'numeric', minute: 'numeric', second: 'numeric',
                hour12: false,
            });
            var parts = {};
            fmt.formatToParts(now).forEach(function (p) { parts[p.type] = p.value; });
            var h = parseInt(parts.hour, 10) % 24; // 24:mm → 0:mm (midnight)
            /* ms not available from Intl; use local ms — acceptable for all real timezones
               (all UTC offsets are whole minutes, so the sub-second position is identical) */
            return {
                h: h, m: parseInt(parts.minute, 10), s: parseInt(parts.second, 10),
                ms: now.getMilliseconds(),
                d: parseInt(parts.day, 10), mo: parseInt(parts.month, 10) - 1,
                yr: parseInt(parts.year, 10),
                dow: Math.max(0, ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday)),
                label: t.split('/').pop().replace(/_/g, ' '),
            };
        } catch (e) {
            /* Invalid timezone — fall back to local silently */
            return getTimeComponents('local');
        }
    }

    function drawHand(ctx, cx, cy, len, width, angle, color, glow, blur) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur || 6; }
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.moveTo(-width * 0.5, 0);
        ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    /* ---- Boot ---- */

    function bootWhenReady() {
        var api = globalThis.DashboardExtensionAPI;
        if (!api) { setTimeout(bootWhenReady, 25); return; }
        var root = document.getElementById('root');
        if (!root) { setTimeout(bootWhenReady, 25); return; }

        document.documentElement.style.cssText = 'width:100%;height:100%;margin:0;padding:0;overflow:hidden;';
        document.body.style.cssText            = 'width:100%;height:100%;margin:0;padding:0;overflow:hidden;box-sizing:border-box;';
        root.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace;';

        var canvas     = document.createElement('canvas');
        canvas.style.cssText = 'flex:0 0 auto;display:block;';
        root.appendChild(canvas);

        var infoWrap   = document.createElement('div');
        infoWrap.style.cssText = 'flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:6px;';
        var digitalDiv = document.createElement('div');
        var dateDiv    = document.createElement('div');
        infoWrap.appendChild(digitalDiv);
        infoWrap.appendChild(dateDiv);
        root.appendChild(infoWrap);

        var state  = { options: {} };
        var rafId  = null;
        var lastSz = 0;
        var dpr    = Math.min(window.devicePixelRatio || 1, 2);

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(function () { lastSz = 0; }).observe(document.body);
        }

        function resolveOpts() {
            var raw = state.options || {};
            var o   = raw.options || raw;
            return {
                handColor:       o.handColor       || DEFAULTS.handColor,
                secondHandColor: o.secondHandColor || DEFAULTS.secondHandColor,
                tickColor:       o.tickColor       || DEFAULTS.tickColor,
                showDigital:     o.showDigital     !== undefined ? !!o.showDigital  : DEFAULTS.showDigital,
                showDate:        o.showDate        !== undefined ? !!o.showDate     : DEFAULTS.showDate,
                showGlow:        o.showGlow        !== undefined ? !!o.showGlow     : DEFAULTS.showGlow,
                timezone:        o.timezone        || DEFAULTS.timezone,
            };
        }

        function tick() {
            var cfg = resolveOpts();
            root.style.background = FACE_COLOR;

            var infoH = (cfg.showDigital || cfg.showDate) ? 44 : 0;
            var W = window.innerWidth  || 300;
            var H = window.innerHeight || 300;
            var size  = Math.max(40, Math.min(W, H - infoH));
            var r     = size / 2 - 8;

            if (size !== lastSz) {
                lastSz = size;
                canvas.width  = Math.round(size * dpr);
                canvas.height = Math.round(size * dpr);
                canvas.style.width  = size + 'px';
                canvas.style.height = size + 'px';
            }

            /* Toggle info elements visibility */
            digitalDiv.style.display = cfg.showDigital ? '' : 'none';
            dateDiv.style.display    = cfg.showDate    ? '' : 'none';
            infoWrap.style.display   = (cfg.showDigital || cfg.showDate) ? '' : 'none';

            var ctx = canvas.getContext('2d');
            if (!ctx) { rafId = requestAnimationFrame(tick); return; }

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var cx = size / 2, cy = size / 2;

            /* Face */
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.fillStyle = FACE_COLOR;
            ctx.fill();
            var grad = ctx.createRadialGradient(cx, cy, 0.1 * r, cx, cy, r);
            grad.addColorStop(0, 'rgba(0,212,170,0.05)');
            grad.addColorStop(1, 'rgba(0,212,170,0)');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.lineWidth   = Math.max(1, 0.018 * r);
            ctx.strokeStyle = hexToRgba(cfg.tickColor, 0.35);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 0.92 * r, 0, 2 * Math.PI);
            ctx.lineWidth   = 1;
            ctx.strokeStyle = hexToRgba(cfg.tickColor, 0.18);
            ctx.stroke();

            /* Tick marks */
            for (var i = 0; i < 60; i++) {
                var a     = i * Math.PI / 30 - Math.PI / 2;
                var major = (i % 5 === 0);
                var inner = major ? 0.84 * r : 0.88 * r;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * inner,      cy + Math.sin(a) * inner);
                ctx.lineTo(cx + Math.cos(a) * 0.94 * r,   cy + Math.sin(a) * 0.94 * r);
                ctx.lineWidth   = major ? Math.max(1.5, 0.016 * r) : 1;
                ctx.strokeStyle = major ? cfg.tickColor : hexToRgba(cfg.tickColor, 0.45);
                ctx.stroke();
            }

            /* Hour numerals (only if face is large enough) */
            if (r >= 60) {
                ctx.fillStyle    = hexToRgba(cfg.handColor, 0.75);
                ctx.font         = Math.max(10, 0.11 * r).toFixed(0) + 'px "SF Mono","Roboto Mono",Menlo,monospace';
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                for (var h = 1; h <= 12; h++) {
                    var ha = h * Math.PI / 6 - Math.PI / 2;
                    ctx.fillText(String(h), cx + Math.cos(ha) * 0.74 * r, cy + Math.sin(ha) * 0.74 * r);
                }
            }

            /* Time components for configured timezone */
            var tc  = getTimeComponents(cfg.timezone);
            var hourAngle   = ((tc.h % 12) + tc.m / 60 + tc.s / 3600) * (Math.PI / 6)  - Math.PI / 2;
            var minuteAngle = (tc.m + tc.s / 60)                       * (Math.PI / 30) - Math.PI / 2;
            var secondAngle = (tc.s + tc.ms / 1000)                    * (Math.PI / 30) - Math.PI / 2;

            drawHand(ctx, cx, cy, 0.50 * r, Math.max(3, 0.045 * r), hourAngle,   cfg.handColor,       cfg.showGlow ? cfg.handColor       : null, 6);
            drawHand(ctx, cx, cy, 0.72 * r, Math.max(2, 0.030 * r), minuteAngle, cfg.handColor,       cfg.showGlow ? cfg.handColor       : null, 4);

            /* Second hand with counterweight */
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(secondAngle);
            if (cfg.showGlow) { ctx.shadowColor = cfg.secondHandColor; ctx.shadowBlur = 12; }
            ctx.beginPath();
            ctx.lineCap   = 'round';
            ctx.lineWidth = Math.max(1.2, 0.014 * r);
            ctx.strokeStyle = cfg.secondHandColor;
            ctx.moveTo(-0.18 * r, 0);
            ctx.lineTo(0.86 * r, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0.86 * r, 0, Math.max(2, 0.022 * r), 0, 2 * Math.PI);
            ctx.fillStyle = cfg.secondHandColor;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            /* Centre dot */
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(3, 0.04 * r), 0, 2 * Math.PI);
            ctx.fillStyle = cfg.secondHandColor;
            if (cfg.showGlow) { ctx.shadowColor = cfg.secondHandColor; ctx.shadowBlur = 10; }
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1.5, 0.018 * r), 0, 2 * Math.PI);
            ctx.fillStyle = FACE_COLOR;
            ctx.fill();

            ctx.restore();

            /* Digital readout */
            var suffix = tc.label ? (' ' + tc.label) : '';
            if (cfg.showDigital) {
                digitalDiv.textContent = pad(tc.h) + ':' + pad(tc.m) + ':' + pad(tc.s) + suffix;
                digitalDiv.style.cssText = 'font-size:16px;font-weight:600;letter-spacing:2px;color:' + cfg.secondHandColor + ';' +
                    (cfg.showGlow ? 'text-shadow:0 0 8px ' + cfg.secondHandColor + ';' : '');
            }
            if (cfg.showDate) {
                dateDiv.textContent = DAYS[tc.dow] + ' ' + pad(tc.d) + ' ' + MONTHS[tc.mo] + ' ' + tc.yr;
                dateDiv.style.cssText = 'font-size:11px;opacity:0.7;letter-spacing:1px;color:' + cfg.handColor + ';';
            }

            rafId = requestAnimationFrame(tick);
        }

        if (typeof api.addOptionsListener === 'function') {
            api.addOptionsListener(function (n) { state.options = n || {}; });
        }
        try {
            if (typeof api.getOptions === 'function') state.options = api.getOptions() || {};
        } catch (e) {}

        requestAnimationFrame(tick);
    }

    bootWhenReady();
})();
