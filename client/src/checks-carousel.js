// "Four checks in one scan" as a FlexCarousel (vanilla port of the React Bits component, 'liquid' preset).
// Fills its container; the container should be full-width. Resizes automatically.
import { Renderer, Program, Mesh, Triangle, Plane, Texture, RenderTarget } from 'ogl';

const CARDS = [
  { n: '01', title: 'Certificate validation', lines: ['TLS chain, expiry, transparency logs,', 'and cryptographic strength. Weak', 'certificates undermine the trust', 'indicator.'] },
  { n: '02', title: 'Web security', lines: ['HTTP security headers, exposed', 'services, and software freshness \u2014', 'weak configurations raise the risk', 'score.'] },
  { n: '03', title: 'Threat analysis', lines: ['Known-bad lists, reputation signals,', 'and suspicious patterns such as', 'look-alike domains and credential-', 'harvesting keywords.'] },
  { n: '04', title: 'Threat intelligence', lines: ['Community-reported threats with', 'source and date, so newly spotted', 'phishing pages are flagged faster', 'than any single list.'] }
];

const CW = 640, CH = 400; // card artwork size
const cardSvg = c => {
  const body = c.lines.map((l, i) => `<text x="48" y="${200 + i * 36}" fill="#8b8b94" font-size="24">${l}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" font-family="Inter,Segoe UI,Arial,sans-serif">
<rect width="${CW}" height="${CH}" rx="28" fill="#0c0d10"/><rect x="1" y="1" width="${CW - 2}" height="${CH - 2}" rx="27" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>
<rect x="48" y="44" width="64" height="64" rx="16" fill="#15161a" stroke="#ffffff" stroke-opacity=".1"/>
<circle cx="80" cy="76" r="14" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M73 76l5 5 9-10" fill="none" stroke="#fff" stroke-width="2.5"/>
<text x="${CW - 48}" y="88" text-anchor="end" fill="#6366f1" font-size="30" font-weight="700" font-family="'Great Day', Inter, Segoe UI, Arial, sans-serif">${c.n}</text>
<text x="48" y="160" fill="#fff" font-size="36" font-weight="700" font-family="'Great Day', Inter, Segoe UI, Arial, sans-serif">${c.title}</text>${body}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

const cardVS = `#version 300 es
in vec3 position; in vec2 uv;
uniform vec4 uRect; uniform vec2 uResolution;
out vec2 vLocal;
void main(){ vLocal = vec2(position.x, -position.y) * uRect.zw; vec2 px = uRect.xy + vLocal;
gl_Position = vec4(px.x/uResolution.x*2.0-1.0, 1.0-px.y/uResolution.y*2.0, 0.0, 1.0); }`;

const cardFS = `#version 300 es
precision highp float;
uniform sampler2D tMap; uniform vec2 uSize; uniform float uRadius, uAlpha, uDpr;
in vec2 vLocal; out vec4 fragColor;
float rb(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
void main(){
  float sd = rb(vLocal, uSize*0.5, uRadius);
  float mask = clamp(0.5 - sd*uDpr, 0.0, 1.0);
  vec2 l = vLocal/uSize + 0.5;
  vec4 t = texture(tMap, vec2(l.x, 1.0-l.y));
  float a = mask * uAlpha * max(t.a, 0.0);
  fragColor = vec4(t.rgb * a, a);
}`;

const lensVS = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

const lensFS = `#version 300 es
precision highp float;
uniform sampler2D tScene; uniform vec2 uResolution, uCenter, uHalf;
uniform float uDpr, uAngle, uInner, uOuter, uFlow;
out vec4 fragColor;
void main(){
  vec2 frag = gl_FragCoord.xy / uDpr; vec2 uv = frag / uResolution;
  vec2 rel = frag - vec2(uCenter.x, uResolution.y - uCenter.y);
  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 local = vec2(ca*rel.x + sa*rel.y, -sa*rel.x + ca*rel.y);
  vec2 k = max(abs(local)/uHalf, vec2(1e-5));
  float nd = length(k);
  vec2 grad = k * sign(local) / uHalf / max(nd, 1e-5);
  float glen = max(length(grad), 1e-6);
  float edge = (nd - 1.0) / glen;
  vec2 outward = grad / glen;
  vec2 normal = vec2(ca*outward.x - sa*outward.y, sa*outward.x + ca*outward.y);
  vec2 along = vec2(-normal.y, normal.x);
  float t = clamp((edge + uInner)/(uInner + uOuter), 0.0, 1.0);
  float ramp = t*t*t*(t*(t*6.0-15.0)+10.0);
  float slope = 16.0*t*t*(1.0-t)*(1.0-t);
  float rx = rel.x / (uResolution.x*0.5);
  float side = smoothstep(0.02, 0.3, abs(rx)) * sign(rx);
  float lift = ramp * side * uFlow;
  vec2 swirl = along * along.y * side * slope * uFlow * 0.35;
  vec2 shifted = uv + (vec2(0.0, -lift) - swirl) / uResolution;
  fragColor = texture(tScene, shifted);
}`;

const wrap = (v, s) => ((((v + s / 2) % s) + s) % s) - s / 2;

export function mountChecksCarousel(container, { cardHeight = 0.55, gap = 24, autoplay = 0 } = {}) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio || 1, 2), alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  const gl = renderer.gl;
  if (!renderer.isWebgl2) return () => {};
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.style.cssText += ';position:relative;overflow:hidden;touch-action:pan-y;cursor:grab;user-select:none';
  container.prepend(canvas);

  const cardProg = new Program(gl, {
    vertex: cardVS, fragment: cardFS, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tMap: { value: null }, uRect: { value: [0, 0, 1, 1] }, uResolution: { value: [1, 1] }, uSize: { value: [1, 1] }, uRadius: { value: 22 }, uAlpha: { value: 1 }, uDpr: { value: 1 } }
  });
  cardProg.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const cardMesh = new Mesh(gl, { geometry: new Plane(gl), program: cardProg });
  const target = new RenderTarget(gl, { width: 2, height: 2, depth: false, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });
  const lensU = { tScene: { value: target.texture }, uResolution: { value: [1, 1] }, uDpr: { value: 1 }, uCenter: { value: [0, 0] }, uHalf: { value: [1, 1] }, uAngle: { value: (62 * Math.PI) / 180 }, uInner: { value: 1 }, uOuter: { value: 1 }, uFlow: { value: 0 } };
  const lensMesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex: lensVS, fragment: lensFS, uniforms: lensU, depthTest: false, depthWrite: false }) });

  const slots = CARDS.map(c => {
    const texture = new Texture(gl, { generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });
    const slot = { texture, loaded: false };
    const img = new Image();
    img.onload = () => { texture.image = img; texture.update(); slot.loaded = true; };
    img.src = cardSvg(c);
    return slot;
  });

  let W = 1, H = 1, pos = 0, goal = 0, vel = 0, raf = 0, last = 0, visible = true, lastAuto = 0;
  const drag = { on: false, x: 0, start: 0, samples: [] };
  const geom = () => { const ch = cardHeight * H, cw = ch * (CW / CH); return { ch, cw, step: cw + gap, loop: (cw + gap) * slots.length }; };

  const resize = () => {
    W = Math.max(1, container.clientWidth); H = Math.max(1, container.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4.5e6 / (W * H)));
    renderer.dpr = dpr; renderer.setSize(W, H);
    target.setSize(Math.max(2, Math.round(W * dpr)), Math.max(2, Math.round(H * dpr)));
    lensU.tScene.value = target.texture;
    const g = geom(); pos = goal = Math.round(pos / g.step) * g.step;
  };

  const frame = now => {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    const g = geom();
    if (!drag.on) {
      if (autoplay && now - lastAuto > autoplay * 1000 && Math.abs(goal - pos) < 1) { goal += g.step; lastAuto = now; }
      const k = 55, c = 2 * Math.sqrt(k), n = Math.ceil(dt * 240), h = dt / n;
      for (let i = 0; i < n; i++) { vel += (k * (goal - pos) - c * vel) * h; pos += vel * h; }
    }
    renderer.dpr = renderer.dpr; // keep size in sync
    cardProg.uniforms.uResolution.value = [W, H];
    cardProg.uniforms.uDpr.value = renderer.dpr;
    const shrink = 1 - 0.2 * Math.min(Math.abs(vel) / 2600, 1);
    const draws = [];
    slots.forEach((s, i) => {
      if (!s.loaded) return;
      const base = wrap(i * g.step - pos, g.loop);
      for (let kx = -2; kx <= 2; kx++) {
        const rel = base + kx * g.loop;
        if (Math.abs(rel) - g.cw / 2 > W / 2 + 40) continue;
        draws.push({ s, rel });
      }
    });
    draws.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
    let first = true;
    for (const d of draws) {
      const cw = g.cw * shrink, ch = g.ch * shrink;
      cardProg.uniforms.tMap.value = d.s.texture;
      cardProg.uniforms.uRect.value = [W / 2 + d.rel, H / 2, cw + 2, ch + 2];
      cardProg.uniforms.uSize.value = [cw, ch];
      renderer.render({ scene: cardMesh, target, clear: first });
      first = false;
    }
    if (first) { renderer.bindFramebuffer(target); gl.viewport(0, 0, target.width, target.height); gl.clear(gl.COLOR_BUFFER_BIT); }
    renderer.bindFramebuffer();
    target.texture.bind(); gl.generateMipmap(gl.TEXTURE_2D);

    // 'liquid' preset lens: width .74, height 1.18 (fractions of container width), tilt 62deg, bend .34, reach .38
    const hw = (0.74 * W) / 2, hh = (1.18 * W) / 2, inner = Math.max(4, 0.38 * (hw + hh) * 0.5);
    lensU.uResolution.value = [W, H]; lensU.uDpr.value = renderer.dpr;
    lensU.uCenter.value = [W / 2, H / 2]; lensU.uHalf.value = [hw, hh];
    lensU.uInner.value = inner; lensU.uOuter.value = inner * 1.6; lensU.uFlow.value = 0.34 * (hw + hh) * 0.45;
    renderer.render({ scene: lensMesh });
  };

  const snap = () => { const g = geom(); goal = Math.round(goal / g.step) * g.step; };
  let wheelT = 0;
  const on = (t, e, f, o) => { t.addEventListener(e, f, o); return () => t.removeEventListener(e, f, o); };
  const offs = [
    on(container, 'pointerdown', e => { drag.on = true; drag.x = e.clientX; drag.start = pos; drag.samples = [[e.clientX, performance.now()]]; container.style.cursor = 'grabbing'; container.setPointerCapture(e.pointerId); vel = 0; }),
    on(container, 'pointermove', e => {
      if (!drag.on) return;
      pos = goal = drag.start - (e.clientX - drag.x);
      const t = performance.now(); drag.samples.push([e.clientX, t]);
      while (drag.samples.length > 2 && t - drag.samples[0][1] > 100) drag.samples.shift();
    }),
    on(container, 'pointerup', () => {
      if (!drag.on) return; drag.on = false; container.style.cursor = 'grab';
      const a = drag.samples[0], b = drag.samples[drag.samples.length - 1];
      const v = b[1] > a[1] ? -((b[0] - a[0]) / (b[1] - a[1])) * 1000 : 0;
      vel = v; goal = pos + v * 0.32; snap();
    }),
    on(container, 'wheel', e => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      goal += Math.max(-120, Math.min(120, d)) * 1.25;
      clearTimeout(wheelT); wheelT = setTimeout(snap, 150);
    }, { passive: false })
  ];

  const ro = new ResizeObserver(resize); ro.observe(container);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  io.observe(container);
  resize(); last = performance.now(); raf = requestAnimationFrame(frame);

  return () => {
    visible = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); offs.forEach(f => f());
    gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove();
  };
}
