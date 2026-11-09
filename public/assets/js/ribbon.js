// Full-width wavy ribbon loop. Recomputes on any size change (resize, fullscreen, split-window).
// Usage: mountRibbon(document.getElementById('ribbon'), ['Threat intelligence', 'Threat analysis', ...]);
export function mountRibbon(el, words, { speed = 60, color = '#6366f1', height = 150 } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible';
  const band = document.createElementNS(NS, 'path');
  const guide = document.createElementNS(NS, 'path');
  guide.id = 'ribbon-guide-' + Math.random().toString(36).slice(2, 7);
  const text = document.createElementNS(NS, 'text');
  const tp = document.createElementNS(NS, 'textPath');
  tp.setAttribute('href', '#' + guide.id);
  text.setAttribute('fill', '#fff');
  text.setAttribute('font-size', '15');
  text.setAttribute('font-weight', '600');
  text.setAttribute('letter-spacing', '2.4');
  text.style.textTransform = 'uppercase';
  text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
  band.setAttribute('fill', 'none');
  band.setAttribute('stroke', color);
  band.setAttribute('stroke-width', '34');
  guide.setAttribute('fill', 'none');
  text.setAttribute('dominant-baseline', 'central');
  text.appendChild(tp);
  svg.append(band, guide, text);
  el.style.cssText += ';position:relative;width:100%;overflow:hidden;height:' + height + 'px';
  el.appendChild(svg);

  const unit = words.join(' \u2726 ') + ' \u2726 ';
  let unitLen = 1, pathLen = 1, raf = 0, last = 0, shift = 0;

  const layout = () => {
    const W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const amp = H * 0.26, wave = Math.max(520, W / 1.6);
    let d = '';
    for (let x = -40; x <= W + 40; x += 6) {
      const y = H / 2 + amp * Math.sin((x / wave) * Math.PI * 2);
      d += (d ? ' L' : 'M') + x + ' ' + y.toFixed(2);
    }
    band.setAttribute('d', d);
    guide.setAttribute('d', d);
    tp.textContent = unit;
    unitLen = Math.max(1, tp.getComputedTextLength());
    pathLen = guide.getTotalLength();
    const copies = Math.ceil(pathLen / unitLen) + 2;
    tp.textContent = unit.repeat(copies);
  };

  const tick = t => {
    raf = requestAnimationFrame(tick);
    shift = (shift + ((t - last) / 1000) * speed) % unitLen;
    last = t;
    tp.setAttribute('startOffset', (-shift).toFixed(2));
  };

  const ro = new ResizeObserver(layout);
  ro.observe(el);
  layout();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still) raf = requestAnimationFrame(t => { last = t; tick(t); });
  return () => { cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); };
}
