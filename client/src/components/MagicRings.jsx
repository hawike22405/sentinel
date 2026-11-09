import { useEffect, useRef } from 'react';
import './MagicRings.css';

function parseColor(str) {
  if (!str) return { r: 168, g: 85, b: 247 };
  const s = String(str).trim();
  if (s.startsWith('#')) {
    let c = s.slice(1);
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const num = parseInt(c, 16);
    if (!isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    }
  }
  const rgbMatch = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  return { r: 168, g: 85, b: 247 };
}

function lerpColor(c1, c2, t) {
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function MagicRings({
  color = '#A855F7',
  colorTwo = '#6366F1',
  motion = 'pulse',
  ringCount = 6,
  speed = 1,
  lineThickness = 2,
  glow = 1,
  hoverScale = 1.2,
  clickBurst = true,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgb1 = parseColor(color);
    const rgb2 = parseColor(colorTwo);

    let width = 0;
    let height = 0;
    let dpr = 1;

    function handleResize() {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    handleResize();

    const mouse = { x: width / 2, y: height / 2, active: false };
    const currentMouse = { x: width / 2, y: height / 2 };
    let currentScale = 1;
    let targetScale = 1;
    const bursts = [];

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
      targetScale = hoverScale;
    }

    function onMouseLeave() {
      mouse.active = false;
      targetScale = 1;
    }

    function onClick(e) {
      if (!clickBurst) return;
      const rect = canvas.getBoundingClientRect();
      bursts.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 12,
        maxRadius: Math.min(width, height) * 0.75,
        alpha: 1,
      });
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);

    const startTime = performance.now();

    function render(now) {
      animRef.current = requestAnimationFrame(render);
      const elapsed = (now - startTime) * 0.001 * speed;
      const introProgress = Math.min(1, (now - startTime) / 1200);

      // Smooth mouse lerp
      const cx = width / 2;
      const cy = height / 2;
      const tx = mouse.active ? mouse.x : cx;
      const ty = mouse.active ? mouse.y : cy;
      currentMouse.x += (tx - currentMouse.x) * 0.06;
      currentMouse.y += (ty - currentMouse.y) * 0.06;
      currentScale += (targetScale - currentScale) * 0.08;

      const centerOffsetX = (currentMouse.x - cx) * 0.16;
      const centerOffsetY = (currentMouse.y - cy) * 0.16;

      ctx.clearRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      const baseRadius = minDim * 0.11;
      const maxRadius = minDim * 0.44;
      const count = Math.max(1, ringCount);

      // Draw Rings
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const col = lerpColor(rgb1, rgb2, t);

        let pulse = 0;
        if (motion === 'pulse') {
          const wavePhase = (elapsed * 2.2 - i * 0.45) % (Math.PI * 2);
          pulse = Math.pow(Math.max(0, Math.sin(wavePhase)), 3);
        } else if (motion === 'ripple') {
          const wavePhase = (elapsed * 2.6 + i * 0.55) % (Math.PI * 2);
          pulse = 0.5 + 0.5 * Math.sin(wavePhase);
        } else {
          // breathe
          pulse = 0.5 + 0.5 * Math.sin(elapsed * 2);
        }

        const ringRadius =
          (baseRadius + t * (maxRadius - baseRadius)) *
          (currentScale * (1 + pulse * 0.045)) *
          introProgress;
        const ringCenterX = cx + centerOffsetX * (1 - t * 0.4);
        const ringCenterY = cy + centerOffsetY * (1 - t * 0.4);

        if (ringRadius <= 0) continue;

        ctx.save();
        ctx.beginPath();

        if (introProgress < 1) {
          const startAngle = Math.PI * (1 - introProgress);
          const endAngle = Math.PI * (1 + introProgress);
          ctx.arc(ringCenterX, ringCenterY, ringRadius, startAngle, endAngle);
        } else {
          ctx.arc(ringCenterX, ringCenterY, ringRadius, 0, Math.PI * 2);
        }

        ctx.strokeStyle = col;
        ctx.lineWidth = lineThickness * (1 + pulse * 0.55);
        ctx.shadowColor = col;
        ctx.shadowBlur = glow * 22 * (0.6 + pulse * 0.8);
        ctx.globalAlpha = Math.min(1, 0.4 + pulse * 0.6);
        ctx.stroke();

        ctx.restore();
      }

      // Draw bursts
      for (let b = bursts.length - 1; b >= 0; b--) {
        const burst = bursts[b];
        burst.radius += (burst.maxRadius - burst.radius) * 0.08 + 4;
        burst.alpha = Math.max(0, 1 - burst.radius / burst.maxRadius);

        if (burst.alpha <= 0.01) {
          bursts.splice(b, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = colorTwo;
        ctx.shadowBlur = 28;
        ctx.globalAlpha = burst.alpha * 0.9;
        ctx.stroke();
        ctx.restore();
      }
    }

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, [
    color,
    colorTwo,
    motion,
    ringCount,
    speed,
    lineThickness,
    glow,
    hoverScale,
    clickBurst,
  ]);

  return (
    <div
      ref={containerRef}
      className={`magic-rings-container ${className}`.trim()}
      style={style}
    >
      <canvas ref={canvasRef} className="magic-rings-canvas" />
    </div>
  );
}
