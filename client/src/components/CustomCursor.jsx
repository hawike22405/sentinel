import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const dotRef = useRef(null);
  const outlineRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;

    let mouse = { x: 0, y: 0 };
    let pos = { x: 0, y: 0 };

    const updateCursor = () => {
      const lerp = (a, b, t) => a + (b - a) * t;
      pos.x = lerp(pos.x, mouse.x, 0.22);
      pos.y = lerp(pos.y, mouse.y, 0.22);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
      }
      if (outlineRef.current) {
        outlineRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
      }
      requestAnimationFrame(updateCursor);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (outlineRef.current && !outlineRef.current.classList.contains('visible')) {
        outlineRef.current.classList.add('visible');
      }
    };

    const setHovered = (on) => {
      if (!outlineRef.current) return;
      if (on) outlineRef.current.classList.add('hovered');
      else outlineRef.current.classList.remove('hovered');
    };

    const clickRipple = (x, y) => {
      if (!outlineRef.current) return;
      outlineRef.current.classList.add('click-ripple');
      outlineRef.current.style.left = x + 'px';
      outlineRef.current.style.top = y + 'px';
      setTimeout(() => outlineRef.current.classList.remove('click-ripple'), 500);
    };

    const elements = document.querySelectorAll(
      'a, button, .btn, input, select, .card-glass',
    );
    elements.forEach((el) => {
      el.addEventListener('mouseenter', () => setHovered(true));
      el.addEventListener('mouseleave', () => setHovered(false));
      el.addEventListener('mousedown', (e) => clickRipple(e.clientX, e.clientY));
    });

    window.addEventListener('mousemove', handleMouseMove);
    updateCursor();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div className="cursor-dot" ref={dotRef} aria-hidden="true" />
      <div className="cursor-outline" ref={outlineRef} aria-hidden="true" />
    </>
  );
}
