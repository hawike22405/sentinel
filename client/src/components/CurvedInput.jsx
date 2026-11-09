import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const FONT_SIZE = 15;
const ICON_SIZE = 18;

// An input bar bent along a circular arc. The visible text, caret, icon and
// button label are drawn in SVG along the curve; a transparent <input> sits on
// top to capture typing, focus and IME/paste behaviour natively.
export default function CurvedInput({
  value: controlledValue,
  onChange,
  onSubmit,
  placeholder = 'https://example.com/login',
  buttonText = 'Scan link',
  type = 'url',
  width = 560,
  bend = 18,
  height = 60,
  radius = 14,
  buttonWidth = 112,
  showButton = true,
  showIcon = true,
  disabled = false,
  ariaLabel = 'Website URL',
  className = '',
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `ci-mask-${uid}`;
  const ringId = `ci-ring-${uid}`;
  const clipId = `ci-clip-${uid}`;
  const textPathId = `ci-path-${uid}`;

  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const pathRef = useRef(null);

  const [innerValue, setInnerValue] = useState('');
  const [w, setW] = useState(width);
  const [fontTick, setFontTick] = useState(0);
  const [layout, setLayout] = useState({ offset: 0, caret: null });

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : innerValue;
  const display = type === 'password' ? '•'.repeat(value.length) : value;

  // Track the container width so the curve never overflows on small screens.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setW(Math.min(width, next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  // Re-measure once web fonts have loaded.
  useEffect(() => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => setFontTick((t) => t + 1));
    }
  }, []);

  // ---- geometry ---------------------------------------------------------
  const h = height;
  const r = Math.min(radius, h / 2);
  const s = Math.max(0, Math.min(bend, w / 4)); // sagitta: how far the middle rises
  const curved = s > 0.5;
  const R = curved ? (w * w) / 4 + s * s : 0;
  const radiusPx = curved ? R / (2 * s) : Infinity;
  const c = w / 2;

  const arc = (x, y, sweep) =>
    curved ? `A ${radiusPx} ${radiusPx} 0 0 ${sweep} ${x} ${y}` : `L ${x} ${y}`;

  // Surface shape, inset by r so a round-joined stroke of width 2r gives rounded corners.
  const innerW = w - 2 * r;
  const sp = curved ? radiusPx - Math.sqrt(radiusPx * radiusPx - (innerW * innerW) / 4) : 0;
  const top = r + sp;
  const bottom = h - r + sp;
  const surfaceD = `M ${r},${top} ${arc(w - r, top, 1)} L ${w - r},${bottom} ${arc(r, bottom, 0)} Z`;

  const svgH = h + s;
  const baseY = h / 2 + s + FONT_SIZE * 0.35; // text baseline at the bar ends
  const textPathD = `M 0,${baseY} ${arc(w, baseY, 1)}`;

  const sagAt = (x) =>
    curved
      ? Math.sqrt(radiusPx * radiusPx - (x - c) ** 2) -
        Math.sqrt(radiusPx * radiusPx - c * c)
      : 0;
  const centerY = (x) => h / 2 + s - sagAt(x);
  const angleAt = (x) =>
    curved
      ? (Math.atan((x - c) / Math.sqrt(radiusPx * radiusPx - (x - c) ** 2)) * 180) / Math.PI
      : 0;
  const arcLen = (x) =>
    curved ? radiusPx * (Math.asin((x - c) / radiusPx) - Math.asin(-c / radiusPx)) : x;

  const btnW = showButton ? buttonWidth : 0;
  const btnX = w - btnW;
  const textStartX = showIcon ? 52 : 22;
  const textEndX = Math.max(textStartX + 20, btnX - 14);
  const availLen = arcLen(textEndX) - arcLen(textStartX);

  // ---- text + caret layout ---------------------------------------------
  useLayoutEffect(() => {
    const textEl = textRef.current;
    const pathEl = pathRef.current;
    if (!pathEl) return;
    const len = textEl && display ? textEl.getComputedTextLength() : 0;
    let offset = arcLen(textStartX);
    if (len > availLen) offset -= len - availLen; // keep the end of the text visible
    const d = offset + len;
    let caret = null;
    try {
      const p = pathEl.getPointAtLength(d);
      const a = pathEl.getPointAtLength(Math.max(0, d - 0.5));
      const b = pathEl.getPointAtLength(d + 0.5);
      caret = { x: p.x, y: p.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    } catch {
      /* path not measurable yet */
    }
    setLayout({ offset, caret });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, w, bend, height, radius, buttonWidth, showButton, showIcon, fontTick]);

  const handleChange = (e) => {
    if (!isControlled) setInnerValue(e.target.value);
    if (onChange) onChange(e);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (onSubmit) onSubmit(value.trim());
  };

  const iconX = 28;
  const iconScale = ICON_SIZE / 24;

  return (
    <div
      ref={wrapRef}
      className={`curved-input-wrapper${disabled ? ' is-disabled' : ''} ${className}`.trim()}
      style={{ maxWidth: width, height: svgH }}
    >
      <svg
        className="curved-input-svg"
        width={w}
        height={svgH}
        viewBox={`0 0 ${w} ${svgH}`}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-2" y="-2" width={w + 4} height={svgH + 4}>
            <path d={surfaceD} fill="white" stroke="white" strokeWidth={2 * r} strokeLinejoin="round" />
          </mask>
          <mask id={ringId} maskUnits="userSpaceOnUse" x="-4" y="-4" width={w + 8} height={svgH + 8}>
            <path d={surfaceD} fill="white" stroke="white" strokeWidth={2 * r + 2} strokeLinejoin="round" />
            <path d={surfaceD} fill="black" stroke="black" strokeWidth={2 * r} strokeLinejoin="round" />
          </mask>
          <clipPath id={clipId}>
            <rect x={textStartX - 4} y="-4" width={textEndX - textStartX + 4} height={svgH + 8} />
          </clipPath>
          <path id={textPathId} ref={pathRef} d={textPathD} />
        </defs>

        <g mask={`url(#${maskId})`}>
          <rect className="ci-surface" x="-2" y="-2" width={w + 4} height={svgH + 4} />
          {showButton && (
            <rect
              className="ci-button-fill"
              x={btnX}
              y="-2"
              width={btnW + 2}
              height={svgH + 4}
            />
          )}
        </g>
        <rect
          className="ci-border"
          x="-4"
          y="-4"
          width={w + 8}
          height={svgH + 8}
          mask={`url(#${ringId})`}
        />

        {showIcon && (
          <g
            className="ci-icon"
            transform={`translate(${iconX} ${centerY(iconX)}) rotate(${angleAt(iconX)}) scale(${iconScale}) translate(-12 -12)`}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </g>
        )}

        <g clipPath={`url(#${clipId})`}>
          {display ? (
            <text ref={textRef} className="ci-text" fontSize={FONT_SIZE}>
              <textPath href={`#${textPathId}`} startOffset={layout.offset}>
                {display}
              </textPath>
            </text>
          ) : (
            <text className="ci-placeholder" fontSize={FONT_SIZE}>
              <textPath href={`#${textPathId}`} startOffset={layout.offset}>
                {placeholder}
              </textPath>
            </text>
          )}
          {layout.caret && (
            <rect
              className="ci-caret"
              x="-1"
              y={-FONT_SIZE * 0.95}
              width="2"
              height={FONT_SIZE * 1.2}
              rx="1"
              transform={`translate(${layout.caret.x} ${layout.caret.y}) rotate(${layout.caret.angle})`}
            />
          )}
        </g>

        {showButton && (
          <text className="ci-button-text" fontSize={14} textAnchor="middle">
            <textPath href={`#${textPathId}`} startOffset={arcLen(btnX + btnW / 2)}>
              {buttonText}
            </textPath>
          </text>
        )}
      </svg>

      <form className="curved-input-form" onSubmit={handleSubmit} noValidate>
        <input
          className="curved-input-field"
          type={type}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ width: btnX }}
        />
        {showButton && (
          <button
            type="submit"
            className="curved-input-button"
            disabled={disabled}
            aria-label={buttonText}
            style={{ width: btnW }}
          />
        )}
      </form>
    </div>
  );
}
