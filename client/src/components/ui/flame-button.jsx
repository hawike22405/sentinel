import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import './flame-button.css';

// JavaScript adaptation of the supplied FlameButton. Pointer position is held in
// CSS variables so hovering does not rerender the scanner or run an idle RAF loop.
export function FlameButton({
  text = 'Scan link',
  showArrow = true,
  height = 44,
  textColor,
  borderColor = 'transparent',
  href,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  style,
  target,
  ...props
}) {
  const wrapperRef = useRef(null);
  const handlePointerMove = (event) => {
    if (disabled || event.pointerType === 'touch') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { left, width } = wrapper.getBoundingClientRect();
    if (!width) return;
    const normX = Math.max(0, Math.min(1, (event.clientX - left) / width));
    wrapper.style.setProperty('--flame-x', `${normX * 100}%`);
    wrapper.style.setProperty('--flame-edge', normX >= 0.5 ? '88%' : '12%');
    wrapper.style.setProperty('--flame-edge-opacity', String(Math.pow(Math.abs(normX - 0.5) * 2, 1.6)));
  };
  const handleClick = (event) => {
    if (disabled) { event.preventDefault(); return; }
    onClick?.(event);
  };
  const Element = href ? 'a' : 'button';
  const linkTarget = target ?? (/^https?:\/\//i.test(href || '') ? '_blank' : undefined);
  return (
    <div
      ref={wrapperRef}
      className={`flame-button-shell ${className}`.trim()}
      data-disabled={disabled || undefined}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerMove}
      style={{ '--flame-height': `${height}px`, '--flame-text': textColor, '--flame-border': borderColor, ...style }}
    >
      <div className="flame-button-glow" aria-hidden="true" />
      <Element
        {...props}
        {...(href ? { href: disabled ? undefined : href, target: linkTarget,
          rel: linkTarget === '_blank' ? 'noopener noreferrer' : undefined,
          'aria-disabled': disabled || undefined, tabIndex: disabled ? -1 : undefined } : { type, disabled })}
        className="flame-button-control"
        onClick={handleClick}
      >
        <span className="flame-button-hotspots" aria-hidden="true">
          <span className="flame-button-core" />
          <span className="flame-button-halo" />
        </span>
        <span className="flame-button-label">{text}</span>
        {showArrow && <ArrowRight className="flame-button-arrow" strokeWidth={2.5} aria-hidden="true" />}
      </Element>
    </div>
  );
}

export default FlameButton;
