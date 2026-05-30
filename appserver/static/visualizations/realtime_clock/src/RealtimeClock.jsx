/*
 * Realtime Clock — Splunk Dashboard Studio Custom Visualization
 *
 * React functional component using the new Dashboard Studio viz framework.
 * Props supplied by Dashboard Studio: { width, height, options, dataSources }
 *
 * Options:
 *   clockFaceColor  (string, default '#050810')
 *   handColor       (string, default '#6aa3f8')
 *   secondHandColor (string, default '#00d4aa')
 *   tickColor       (string, default '#00d4aa')
 *   showDigital     (bool,   default true)
 *   showDate        (bool,   default true)
 *   showGlow        (bool,   default true)
 *   timezone        (string, 'local' | 'utc', default 'local')
 */

import React, { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Pure drawing helpers — no `this`, just canvas context + data
// ---------------------------------------------------------------------------

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(0, 212, 170, ${alpha})`;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0, 212, 170, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pad(n) {
    return (n < 10 ? '0' : '') + n;
}

function drawFace(ctx, cx, cy, radius, opts) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = opts.clockFaceColor;
    ctx.fill();

    const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0, 212, 170, 0.05)');
    grad.addColorStop(1, 'rgba(0, 212, 170, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.lineWidth = Math.max(1, radius * 0.018);
    ctx.strokeStyle = hexToRgba(opts.tickColor, 0.35);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.92, 0, 2 * Math.PI);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(opts.tickColor, 0.18);
    ctx.stroke();
}

function drawTicks(ctx, cx, cy, radius, opts) {
    for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI) / 30 - Math.PI / 2;
        const isHour = i % 5 === 0;
        const inner = isHour ? radius * 0.84 : radius * 0.88;
        const outer = radius * 0.94;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.lineWidth = isHour ? Math.max(1.5, radius * 0.016) : 1;
        ctx.strokeStyle = isHour ? opts.tickColor : hexToRgba(opts.tickColor, 0.45);
        ctx.stroke();
    }
}

function drawNumerals(ctx, cx, cy, radius, opts) {
    if (radius < 60) return;
    ctx.fillStyle = hexToRgba(opts.handColor, 0.75);
    ctx.font = `${Math.max(10, radius * 0.11).toFixed(0)}px "SF Mono", "Roboto Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) {
        const angle = (h * Math.PI) / 6 - Math.PI / 2;
        ctx.fillText(String(h),
            cx + Math.cos(angle) * (radius * 0.74),
            cy + Math.sin(angle) * (radius * 0.74));
    }
}

function drawSingleHand(ctx, cx, cy, length, width, angle, color, glowColor, glowBlur) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = glowBlur; }
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.moveTo(-width * 0.5, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawSecondHand(ctx, cx, cy, radius, angle, opts) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    if (opts.showGlow) { ctx.shadowColor = opts.secondHandColor; ctx.shadowBlur = 12; }
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, radius * 0.014);
    ctx.strokeStyle = opts.secondHandColor;
    ctx.moveTo(-radius * 0.18, 0);
    ctx.lineTo(radius * 0.86, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radius * 0.86, 0, Math.max(2, radius * 0.022), 0, 2 * Math.PI);
    ctx.fillStyle = opts.secondHandColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawHands(ctx, cx, cy, radius, opts, serverOffsetMs) {
    const now = new Date(Date.now() + serverOffsetMs);
    const useUtc = opts.timezone === 'utc';

    const hours   = useUtc ? now.getUTCHours()        : now.getHours();
    const minutes = useUtc ? now.getUTCMinutes()      : now.getMinutes();
    const seconds = useUtc ? now.getUTCSeconds()      : now.getSeconds();
    const ms      = useUtc ? now.getUTCMilliseconds() : now.getMilliseconds();

    const hourAngle   = ((hours % 12) + minutes / 60 + seconds / 3600) * (Math.PI / 6) - Math.PI / 2;
    const minuteAngle = (minutes + seconds / 60) * (Math.PI / 30) - Math.PI / 2;
    const secondAngle = (seconds + ms / 1000) * (Math.PI / 30) - Math.PI / 2;

    drawSingleHand(ctx, cx, cy, radius * 0.50, Math.max(3, radius * 0.045), hourAngle,
        opts.handColor, opts.showGlow ? opts.handColor : null, 6);
    drawSingleHand(ctx, cx, cy, radius * 0.72, Math.max(2, radius * 0.030), minuteAngle,
        opts.handColor, opts.showGlow ? opts.handColor : null, 4);
    drawSecondHand(ctx, cx, cy, radius, secondAngle, opts);

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
}

function updateDigital(digitalEl, dateEl, opts, serverOffsetMs) {
    const now = new Date(Date.now() + serverOffsetMs);
    const useUtc = opts.timezone === 'utc';

    if (opts.showDigital && digitalEl) {
        const hh = pad(useUtc ? now.getUTCHours()   : now.getHours());
        const mm = pad(useUtc ? now.getUTCMinutes() : now.getMinutes());
        const ss = pad(useUtc ? now.getUTCSeconds() : now.getSeconds());
        digitalEl.textContent = `${hh}:${mm}:${ss}${useUtc ? ' UTC' : ''}`;
    }

    if (opts.showDate && dateEl) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const days   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
        const d  = useUtc ? now.getUTCDate()     : now.getDate();
        const mo = useUtc ? now.getUTCMonth()    : now.getMonth();
        const y  = useUtc ? now.getUTCFullYear() : now.getFullYear();
        const wd = useUtc ? now.getUTCDay()      : now.getDay();
        dateEl.textContent = `${days[wd]} ${pad(d)} ${months[mo]} ${y}`;
    }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
    clockFaceColor: '#050810',
    handColor: '#6aa3f8',
    secondHandColor: '#00d4aa',
    tickColor: '#00d4aa',
    showDigital: true,
    timezone: 'local',
    showDate: true,
    showGlow: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RealtimeClock = ({ width = 300, height = 300, options = {}, dataSources = {} }) => {
    const canvasRef    = useRef(null);
    const rafRef       = useRef(null);
    const serverOff    = useRef(0);
    const digitalRef   = useRef(null);
    const dateRef      = useRef(null);

    const opts = {
        clockFaceColor:  options.clockFaceColor  || DEFAULTS.clockFaceColor,
        handColor:       options.handColor        || DEFAULTS.handColor,
        secondHandColor: options.secondHandColor  || DEFAULTS.secondHandColor,
        tickColor:       options.tickColor        || DEFAULTS.tickColor,
        showDigital:     options.showDigital  !== undefined ? Boolean(options.showDigital)  : DEFAULTS.showDigital,
        showDate:        options.showDate     !== undefined ? Boolean(options.showDate)     : DEFAULTS.showDate,
        showGlow:        options.showGlow     !== undefined ? Boolean(options.showGlow)     : DEFAULTS.showGlow,
        timezone:        (options.timezone || DEFAULTS.timezone).toLowerCase(),
    };

    // Extract server-time offset for clock-skew correction
    useEffect(() => {
        try {
            const rows = dataSources?.primary?.data?.rows;
            if (rows?.length > 0) {
                const ts = parseFloat(rows[0][0]);
                if (!isNaN(ts)) serverOff.current = ts * 1000 - Date.now();
            }
        } catch (_) { /* ignore */ }
    }, [dataSources]);

    // Animation loop — restarts when dimensions or palette change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr  = window.devicePixelRatio || 1;
        const size = Math.max(40, Math.min(width, height));

        canvas.width  = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        canvas.style.width  = `${size}px`;
        canvas.style.height = `${size}px`;

        const captured = { ...opts }; // snapshot for closure stability

        const loop = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const cssSize = canvas.width / dpr;
                const cx = cssSize / 2;
                const cy = cssSize / 2;
                const radius = (cssSize / 2) - 8;

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                drawFace(ctx, cx, cy, radius, captured);
                drawTicks(ctx, cx, cy, radius, captured);
                drawNumerals(ctx, cx, cy, radius, captured);
                drawHands(ctx, cx, cy, radius, captured, serverOff.current);

                ctx.restore();
            }
            updateDigital(digitalRef.current, dateRef.current, captured, serverOff.current);
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height,
        opts.clockFaceColor, opts.handColor, opts.secondHandColor, opts.tickColor,
        opts.showDigital, opts.showDate, opts.showGlow, opts.timezone]);

    const showInfo = opts.showDigital || opts.showDate;

    return (
        <div style={{
            width,
            height,
            background: opts.clockFaceColor,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"SF Mono", "Roboto Mono", Menlo, Consolas, monospace',
            overflow: 'hidden',
            padding: '8px',
            boxSizing: 'border-box',
        }}>
            <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <canvas ref={canvasRef} />
            </div>
            {showInfo && (
                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '6px' }}>
                    {opts.showDigital && (
                        <div
                            ref={digitalRef}
                            style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: opts.secondHandColor,
                                letterSpacing: '2px',
                                textShadow: opts.showGlow ? `0 0 8px ${opts.secondHandColor}` : 'none',
                            }}
                        />
                    )}
                    {opts.showDate && (
                        <div
                            ref={dateRef}
                            style={{
                                fontSize: '11px',
                                color: opts.handColor,
                                opacity: 0.7,
                                letterSpacing: '1px',
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default RealtimeClock;
