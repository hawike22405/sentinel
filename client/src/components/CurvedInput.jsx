import { useRef, useState } from 'react';

export default function CurvedInput({
  placeholder = 'https://example.com/login',
  buttonText = 'Scan link',
  theme = 'dark',
  bend = 28,
  height = 64,
  width = 450,
  onSubmit,
  type = 'url',
  showButton = true,
  showIcon = true,
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'rgba(20, 20, 20, 0.55)' : 'rgba(255, 255, 255, 0.62)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(2, 6, 23, 0.09)';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#8e8e8e' : '#475569';
  const accentColor = '#38bdf8';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(value.trim());
  };

  return (
    <div
      className="curved-input-wrapper"
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        className="curved-input-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      >
        <defs>
          <filter
            id="curved-input-shadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path
          id="curved-path"
          d={`M 0,${height / 2} Q ${width / 2},${bend} ${width},${height / 2} L ${width},${height} L 0,${height} Z`}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth="1"
          filter="url(#curved-input-shadow)"
        />
      </svg>

      <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        {showIcon && (
          <span
            className="curved-input-icon"
            style={{
              color: accentColor,
              marginLeft: 14,
              fontSize: 18,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            🔗
          </span>
        )}
        <input
          ref={inputRef}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: textColor,
            fontSize: 15,
            fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
            paddingLeft: showIcon ? 44 : 18,
            paddingRight: showButton ? 110 : 18,
            width: '100%',
          }}
          disabled={false}
          aria-label="Website URL"
        />
        {showButton && (
          <button
            type="submit"
            className="curved-input-button"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              background: accentColor,
              color: '#000000',
              border: 'none',
              borderRadius: '0 12px 12px 0',
              padding: 0,
              width: 96,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
              zIndex: 2,
            }}
          >
            {buttonText}
          </button>
        )}
      </form>
    </div>
  );
}
