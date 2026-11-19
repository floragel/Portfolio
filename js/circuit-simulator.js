/**
 * Circuit Simulator v2
 * A small breadboard lab: drag parts, wire holes, and watch a real (linear) circuit
 * solve in real time: LED brightness from current, burnt LEDs, motor speed, short circuits.
 *
 * - Pointer Events: mouse, pen and touch (pinch to zoom, drag background to pan).
 * - Persistent SVG nodes: moves only update transforms, nothing is rebuilt per frame.
 * - Nodal analysis: battery (9 V, 0.5 Ω), resistors, motor (25 Ω), push button,
 *   LEDs modelled as Vf + series resistance with on/off iteration.
 * Public API (unchanged): CircuitSimulator.init(containerId), CircuitSimulator.reset()
 */
const CircuitSimulator = (function () {
  'use strict';

  // ---------- geometry ----------
  const P = 20;                 // hole pitch (world units)
  const COLS = 30;
  const BB = { x: 150, y: 70 }; // breadboard origin
  const PADX = 28;
  // 14 rows: T+, T-, a..e, f..j, B+, B-
  const ROW_Y = (() => {
    const ys = []; let y = 22;
    ys.push(y); ys.push(y += P);                 // top rails
    y += 30; for (let i = 0; i < 5; i++) ys.push(y + i * P); // a..e
    y += 4 * P + 36; for (let i = 0; i < 5; i++) ys.push(y + i * P); // f..j
    y += 4 * P + 30; ys.push(y); ys.push(y += P); // bottom rails
    return ys;
  })();
  const ROW_NAMES = ['+', '−', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', '+', '−'];
  const BB_W = PADX * 2 + (COLS - 1) * P;
  const BB_H = ROW_Y[13] + 22;
  const holeX = c => BB.x + PADX + c * P;
  const holeY = r => BB.y + ROW_Y[r];
  const isRail = r => r < 2 || r > 11;

  const V_BAT = 9, R_BAT = 0.5, R_MOTOR = 25, R_BTN = 0.05, R_LED = 15, I_BURN = 0.08, I_SHORT = 2;
  const LED_COLORS = [
    { name: { fr: 'rouge', en: 'red' }, off: '#5c1a17', on: '#ff3b2f', glow: '#ff5a40', vf: 1.9 },
    { name: { fr: 'verte', en: 'green' }, off: '#123d22', on: '#38e07a', glow: '#4dff8f', vf: 2.1 },
    { name: { fr: 'jaune', en: 'yellow' }, off: '#4a3d10', on: '#ffd23f', glow: '#ffe066', vf: 2.0 },
    { name: { fr: 'bleue', en: 'blue' }, off: '#14234d', on: '#4d8dff', glow: '#7aa8ff', vf: 3.0 },
  ];
  const RES_VALUES = [220, 470, 1000, 100];
  const WIRE_COLORS = ['#e5484d', '#3e63dd', '#30a46c', '#f5a524', '#8e4ec6', '#12a594', '#e8e8e8'];

  // ---- Arduino (programmable board) ----
  const ARD_PINS = [13, 12, 11, 10, 9, 8];
  const ARD_PWM = new Set([9, 10, 11]);
  const ARD_W = 128, ARD_H = 92, R_PIN = 25, I_PIN_MAX = 0.04;
  const ARD_HEADER = [...ARD_PINS.map(n => 'D' + n), 'GND', '5V'];
  const ardPinOffset = name => ({ x: 12 + ARD_HEADER.indexOf(name) * 14.5, y: 0 });
  const PROGRAMS = {
    traffic: { fr: 'Feu tricolore', en: 'Traffic light', code:
`// Feu tricolore : D11 vert, D12 jaune, D13 rouge
void setup() {
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(11, HIGH); // vert
  delay(2000);
  digitalWrite(11, LOW);

  digitalWrite(12, HIGH); // jaune
  delay(700);
  digitalWrite(12, LOW);

  digitalWrite(13, HIGH); // rouge
  delay(2000);
  digitalWrite(13, LOW);
}` },
    blink: { fr: 'Clignotement', en: 'Blink', code:
`// La LED sur D13 clignote toutes les 500 ms
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}` },
    fade: { fr: 'Fondu (PWM)', en: 'Fade (PWM)', code:
`// Fondu sur D11 avec analogWrite (PWM : D9, D10, D11)
int brightness = 0;
int step = 5;

void setup() {
  pinMode(11, OUTPUT);
}

void loop() {
  analogWrite(11, brightness);
  brightness = brightness + step;
  if (brightness <= 0 || brightness >= 255) {
    step = -step;
  }
  delay(30);
}` },
    chase: { fr: 'Chenillard', en: 'Chaser', code:
`// Les trois LEDs s'allument l'une après l'autre
void setup() {
  for (int pin = 11; pin <= 13; pin++) {
    pinMode(pin, OUTPUT);
  }
}

void loop() {
  for (int pin = 11; pin <= 13; pin++) {
    digitalWrite(pin, HIGH);
    delay(250);
    digitalWrite(pin, LOW);
  }
}` },
  };

  // ---------- state ----------
  let state, uid = 1;
  const lang = () => { try { return localStorage.getItem('language') === 'fr' ? 'fr' : 'en'; } catch (e) { return 'en'; } };
  const T = (fr, en) => (lang() === 'fr' ? fr : en);

  const PARTS = {
    led: { leads: [[0, 0], [P, 0]] },
    resistor: { leads: [[0, 0], [4 * P, 0]] },
    motor: { leads: [[0, 0], [2 * P, 0]] },
    button: { leads: [[0, 0], [2 * P, 0]] },
  };

  // Example: red LED + 220 Ω (bright), green LED + 1 kΩ (dim), motor behind a push button.
  function exampleState() {
    const hole = (c, r) => ({ x: holeX(c), y: holeY(r) });
    const W = (from, to, color) => ({ id: 'w' + uid++, from, to, color });
    return {
      battery: { x: 40, y: 150 },
      comps: [
        { id: 'r1', type: 'resistor', value: 220, pos: hole(5, 2) },   // a6 – a10
        { id: 'l1', type: 'led', color: 0, pos: hole(9, 6) },          // e10 (+) e11 (−)
        { id: 'b1', type: 'button', pos: hole(15, 2) },                // a16 – a18
        { id: 'm1', type: 'motor', pos: hole(17, 6) },                 // e18 – e20
        { id: 'r2', type: 'resistor', value: 1000, pos: hole(22, 2) }, // a23 – a27
        { id: 'l2', type: 'led', color: 1, pos: hole(26, 6) },         // e27 (+) e28 (−)
      ],
      wires: [
        W('bat+', 'H:1:0', WIRE_COLORS[0]), W('bat-', 'H:1:1', '#2b2f34'),
        W('H:5:0', 'H:5:4', WIRE_COLORS[0]), W('H:10:5', 'H:10:1', '#2b2f34'),
        W('H:15:0', 'H:15:4', WIRE_COLORS[0]), W('H:19:5', 'H:19:1', '#2b2f34'),
        W('H:22:0', 'H:22:4', WIRE_COLORS[0]), W('H:27:5', 'H:27:1', '#2b2f34'),
      ],
      view: null,
      burnt: {},
      wireColor: 1,
      arduino: null,
      code: PROGRAMS.traffic.code,
      program: 'traffic',
    };
  }
  const normalizeExample = s => s;

  // ---------- topology ----------
  function compLeads(c) {
    return PARTS[c.type].leads.map(([dx, dy], i) => ({ id: `L:${c.id}:${i}`, x: c.pos.x + dx, y: c.pos.y + dy, dx, dy }));
  }

  function nearestRow(y) {
    let best = -1, bd = 1e9;
    for (let r = 0; r < 14; r++) { const d = Math.abs(holeY(r) - y); if (d < bd) { bd = d; best = r; } }
    return bd <= P * 0.55 ? best : -1;
  }
  function nearestHole(x, y, maxD = P * 0.55) {
    const r = nearestRow(y); if (r < 0) return null;
    const c = Math.round((x - BB.x - PADX) / P);
    if (c < 0 || c >= COLS) return null;
    const hx = holeX(c), hy = holeY(r);
    return Math.hypot(hx - x, hy - y) <= maxD ? { c, r, x: hx, y: hy, id: `H:${c}:${r}` } : null;
  }

  // snapping: returns {holes:[ids], pos:{x,y}} or null
  function computeSnap(c, occupied) {
    const leads = PARTS[c.type].leads;
    const h0 = nearestHole(c.pos.x, c.pos.y, P * 0.6); if (!h0) return null;
    const holes = [];
    for (const [dx] of leads) {
      const cc = h0.c + Math.round(dx / P);
      if (cc < 0 || cc >= COLS) return null;
      const id = `H:${cc}:${h0.r}`;
      if (occupied.has(id)) return null;
      holes.push(id);
    }
    return { holes, pos: { x: h0.x, y: h0.y } };
  }

  function computeSnaps() {
    const occupied = new Map();
    for (const c of state.comps) {
      const sn = computeSnap(c, occupied);
      c.snap = sn;
      if (sn) { c.pos = { ...sn.pos }; sn.holes.forEach(h => occupied.set(h, c.id)); }
    }
    return occupied;
  }

  function pinPos(id) {
    if (id === 'bat+') return { x: state.battery.x + 48, y: state.battery.y - 6 };
    if (id === 'bat-') return { x: state.battery.x + 18, y: state.battery.y - 6 };
    if (id.startsWith('A:')) { if (!state.arduino) return null; const o = ardPinOffset(id.slice(2)); return { x: state.arduino.x + o.x, y: state.arduino.y + o.y }; }
    if (id.startsWith('H:')) { const [, c, r] = id.split(':').map(Number); return { x: holeX(c), y: holeY(r) }; }
    if (id.startsWith('L:')) {
      const [, cid, i] = id.split(':'); const c = state.comps.find(k => k.id === cid); if (!c) return null;
      const [dx, dy] = PARTS[c.type].leads[+i]; return { x: c.pos.x + dx, y: c.pos.y + dy };
    }
    return null;
  }

  // ---------- simulation (nodal analysis) ----------
  function simulate() {
    const parent = new Map();
    const find = a => { if (!parent.has(a)) parent.set(a, a); let r = a; while (parent.get(r) !== r) r = parent.get(r); let x = a; while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
    const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

    for (let c = 0; c < COLS; c++) {
      for (const r of [0, 1, 12, 13]) if (c > 0) unite(`H:${c}:${r}`, `H:${c - 1}:${r}`);
      for (let r = 3; r <= 6; r++) unite(`H:${c}:${r}`, `H:${c}:2`);
      for (let r = 8; r <= 11; r++) unite(`H:${c}:${r}`, `H:${c}:7`);
    }
    for (const w of state.wires) unite(w.from, w.to);
    for (const c of state.comps) if (c.snap) compLeads(c).forEach((l, i) => unite(l.id, c.snap.holes[i]));

    // elements: {a, b, kind, g, vf, comp}
    const els = [{ a: 'bat+', b: 'bat-', kind: 'bat' }];
    for (const c of state.comps) {
      const [a, b] = compLeads(c).map(l => l.id);
      if (c.type === 'resistor') els.push({ a, b, kind: 'r', g: 1 / c.value, comp: c });
      if (c.type === 'motor') els.push({ a, b, kind: 'r', g: 1 / R_MOTOR, comp: c });
      if (c.type === 'button' && c.pressed) els.push({ a, b, kind: 'r', g: 1 / R_BTN, comp: c });
      if (c.type === 'led' && !state.burnt[c.id]) els.push({ a, b, kind: 'led', g: 1 / R_LED, vf: LED_COLORS[c.color].vf, comp: c, on: false });
    }
    if (state.arduino) {
      els.push({ a: 'A:5V', b: 'A:GND', kind: 'src', v: 5, g: 1 / 0.5 });
      for (const n of ARD_PINS) if (ard.modes[n] === 1) els.push({ a: 'A:D' + n, b: 'A:GND', kind: 'src', v: 5 * (ard.out[n] || 0) / 255, g: 1 / R_PIN, pin: n });
    }

    const gnd = find('bat-');
    const idx = new Map(); const nodes = [];
    for (const e of els) for (const t of [e.a, e.b]) { const n = find(t); if (n !== gnd && !idx.has(n)) { idx.set(n, nodes.length); nodes.push(n); } }
    const N = nodes.length;
    const volt = n => { const r = find(n); return r === gnd ? 0 : (state._v ? state._v[idx.get(r)] || 0 : 0); };

    let v = new Array(N).fill(0);
    for (let iter = 0; iter < 12; iter++) {
      const G = Array.from({ length: N }, () => new Array(N).fill(0));
      const I = new Array(N).fill(0);
      for (let i = 0; i < N; i++) G[i][i] += 1e-9; // keep floating nets solvable
      const stamp = (a, b, g, isrc) => { // current isrc injected into a, drawn from b
        const ia = idx.has(find(a)) ? idx.get(find(a)) : -1, ib = idx.has(find(b)) ? idx.get(find(b)) : -1;
        if (ia >= 0) { G[ia][ia] += g; I[ia] += isrc; }
        if (ib >= 0) { G[ib][ib] += g; I[ib] -= isrc; }
        if (ia >= 0 && ib >= 0) { G[ia][ib] -= g; G[ib][ia] -= g; }
      };
      for (const e of els) {
        if (e.kind === 'bat') stamp(e.a, e.b, 1 / R_BAT, V_BAT / R_BAT);
        else if (e.kind === 'r') stamp(e.a, e.b, e.g, 0);
        else if (e.kind === 'src') stamp(e.a, e.b, e.g, e.v * e.g);
        else if (e.kind === 'led' && e.on) stamp(e.a, e.b, e.g, e.g * e.vf);
      }
      v = solve(G, I);
      state._v = v;
      let changed = false;
      for (const e of els) if (e.kind === 'led') {
        const dv = volt(e.a) - volt(e.b);
        const i = e.on ? e.g * (dv - e.vf) : 0;
        if (!e.on && dv > e.vf + 1e-6) { e.on = true; changed = true; }
        else if (e.on && i < 0) { e.on = false; changed = true; }
      }
      if (!changed) break;
    }

    const res = { leds: {}, motors: {}, batI: 0, short: false, burntNow: [], pinI: {} };
    for (const e of els) {
      const dv = volt(e.a) - volt(e.b);
      if (e.kind === 'bat') res.batI = (V_BAT - dv) / R_BAT;
      if (e.kind === 'led') { const i = e.on ? Math.max(0, e.g * (dv - e.vf)) : 0; res.leds[e.comp.id] = i; if (i > I_BURN) res.burntNow.push(e.comp.id); }
      if (e.kind === 'r' && e.comp.type === 'motor') res.motors[e.comp.id] = Math.abs(dv * e.g) * Math.sign(dv);
      if (e.kind === 'src' && e.pin) res.pinI[e.pin] = (e.v - dv) * e.g;
    }
    res.short = res.batI > I_SHORT;
    return res;
  }

  function solve(A, b) {
    const n = b.length; if (!n) return [];
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; if (Math.abs(d) < 1e-15) continue;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((row, i) => (Math.abs(row[i]) < 1e-15 ? 0 : row[n] / row[i]));
  }

  // ---------- DOM ----------
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  let root, svg, gWorld, gWires, gComps, gTop, tempWire, hoverRing, statusEl, trashEl, compNodes = new Map(), wireNodes = new Map(), batteryNode;
  let sim = { leds: {}, motors: {}, batI: 0, short: false, pinI: {} };
  const ard = { modes: {}, out: {}, running: false, timer: 0, it: null, error: null };
  let motorAngles = {}, rafId = 0, lastT = 0;

  function css() {
    if (document.getElementById('cs2-style')) return;
    const st = document.createElement('style'); st.id = 'cs2-style';
    st.textContent = `
      .cs2 { position: relative; height: 100%; display: flex; flex-direction: column; background: #0c0d0f; color: #ECEAE4; font: 500 13px/1.3 Inter, system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
      .cs2-bar { display: flex; align-items: center; gap: 6px; padding: 10px 64px 10px 12px; border-bottom: 1px solid #1f2226; overflow-x: auto; scrollbar-width: none; }
      .cs2-bar::-webkit-scrollbar { display: none; }
      .cs2-btn { flex: none; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 11px; border-radius: 999px; border: 1px solid #2a2e33; background: #16181b; color: #ECEAE4; font: inherit; cursor: pointer; transition: background-color .15s, border-color .15s; }
      .cs2-btn:hover { background: #1f2226; border-color: #3a3f45; }
      .cs2-btn.solid { background: #ECEAE4; color: #111315; border-color: #ECEAE4; }
      .cs2-btn i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
      .cs2-sep { flex: none; width: 1px; height: 20px; background: #2a2e33; margin: 0 4px; }
      .cs2-stage { position: relative; flex: 1; min-height: 0; }
      .cs2-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: default; }
      .cs2-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 9px 14px; border-top: 1px solid #1f2226; font-size: 12.5px; color: #A3A4A6; min-height: 38px; }
      .cs2-status b { color: #ECEAE4; font-weight: 600; }
      .cs2-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; background: #16181b; }
      .cs2-chip.warn { background: #3a1513; color: #ffb4a8; }
      .cs2-chip.ok { background: #13281b; color: #a6e8bd; }
      .cs2-trash { position: absolute; right: 14px; bottom: 14px; width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: #1a1c1f; border: 1px dashed #4a4f55; color: #A3A4A6; opacity: 0; transform: scale(.9); transition: opacity .15s, transform .15s, background-color .15s; pointer-events: none; }
      .cs2-trash.show { opacity: 1; transform: none; }
      .cs2-trash.hot { background: #3a1513; border-color: #e5484d; color: #ffb4a8; }
      .cs2-main { position: relative; flex: 1; min-height: 0; display: flex; }
      .cs2-main .cs2-stage { flex: 1; }
      .cs2-code { width: 340px; flex: none; display: flex; flex-direction: column; border-left: 1px solid #1f2226; background: #0a0b0d; }
      .cs2-code[hidden] { display: none; }
      .cs2-code-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1f2226; }
      .cs2-code-head b { font-weight: 600; color: #7fd1d6; }
      .cs2-prog { flex: 1; min-width: 0; height: 30px; border-radius: 8px; border: 1px solid #2a2e33; background: #16181b; color: #ECEAE4; font: inherit; padding: 0 8px; }
      .cs2-x { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #2a2e33; background: none; color: #ECEAE4; font-size: 18px; cursor: pointer; }
      .cs2-editor { flex: 1; min-height: 0; resize: none; border: 0; outline: none; padding: 12px 14px; background: #0a0b0d; color: #E7E9EC; font: 400 12.5px/1.6 'Fragment Mono', ui-monospace, monospace; tab-size: 2; white-space: pre; overflow: auto; }
      .cs2-code-actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-top: 1px solid #1f2226; }
      .cs2-console { padding: 8px 12px 10px; font: 400 11.5px/1.45 'Fragment Mono', ui-monospace, monospace; color: #A3A4A6; min-height: 34px; }
      .cs2-console.err { color: #ffb4a8; }
      @media (max-width: 760px) {
        .cs2-code { position: absolute; left: 0; right: 0; bottom: 0; width: auto; height: 62%; border-left: 0; border-top: 1px solid #2a2e33; z-index: 3; box-shadow: 0 -20px 40px rgba(0,0,0,.5); }
      }
      .cs2-hint { position: absolute; left: 12px; bottom: 12px; max-width: 70%; padding: 7px 11px; border-radius: 10px; background: rgba(22,24,27,.9); color: #A3A4A6; font-size: 12px; pointer-events: none; transition: opacity .3s; }
      .cs2 .part { cursor: grab; }
      .cs2 .part.dragging { cursor: grabbing; }
      .cs2 .pin { cursor: crosshair; }
      .cs2 .wire { cursor: pointer; }
      .cs2 .wire:hover .wire-core { stroke-width: 6.5; }
    `;
    document.head.appendChild(st);
  }

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    css();
    if (!state) { state = normalizeExample(exampleState()); }
    container.innerHTML = '';
    container.style.height = window.innerWidth < 640 ? 'clamp(340px, 52vh, 420px)' : 'clamp(430px, 64vh, 580px)';
    container.style.background = '#0c0d0f';

    root = document.createElement('div'); root.className = 'cs2';
    root.innerHTML = `
      <div class="cs2-bar" role="toolbar" aria-label="${T('Composants', 'Parts')}">
        <button class="cs2-btn" data-add="led"><i style="background:#ff3b2f"></i>${T('LED', 'LED')}</button>
        <button class="cs2-btn" data-add="resistor"><i style="background:#c9a25e;border-radius:3px"></i>${T('Résistance', 'Resistor')}</button>
        <button class="cs2-btn" data-add="button"><i style="background:#e5484d"></i>${T('Bouton', 'Button')}</button>
        <button class="cs2-btn" data-add="motor"><i style="background:#8b9096"></i>${T('Moteur', 'Motor')}</button>
        <button class="cs2-btn" data-act="arduino"><i style="background:#00979d;border-radius:3px"></i>Arduino</button>
        <span class="cs2-sep"></span>
        <button class="cs2-btn" data-act="fit">${T('Recentrer', 'Fit')}</button>
        <span class="cs2-sep"></span>
        <button class="cs2-btn" data-act="clear">${T('Vider', 'Clear')}</button>
        <button class="cs2-btn solid" data-act="reset">${T('Exemple', 'Example')}</button>
      </div>
      <div class="cs2-main">
        <div class="cs2-stage"></div>
        <div class="cs2-code" hidden>
          <div class="cs2-code-head"><b>Arduino</b>
            <select class="cs2-prog" aria-label="${T('Exemples', 'Examples')}">${Object.entries(PROGRAMS).map(([k, v]) => `<option value="${k}">${v[lang()]}</option>`).join('')}</select>
            <button class="cs2-x" data-code="close" aria-label="${T('Fermer', 'Close')}">×</button></div>
          <textarea class="cs2-editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${T('Code Arduino', 'Arduino code')}"></textarea>
          <div class="cs2-code-actions">
            <button class="cs2-btn solid" data-code="run">▶ ${T('Téléverser', 'Upload')}</button>
            <button class="cs2-btn" data-code="stop">■ Stop</button>
            <button class="cs2-btn" data-code="demo">${T('Montage d\'exemple', 'Example wiring')}</button>
          </div>
          <div class="cs2-console" aria-live="polite"></div>
        </div>
      </div>
      <div class="cs2-status" aria-live="polite"></div>`;
    container.appendChild(root);
    const stage = root.querySelector('.cs2-stage');
    statusEl = root.querySelector('.cs2-status');

    svg = el('svg', { class: 'cs2-svg' }, stage);
    buildDefs();
    gWorld = el('g', {}, svg);
    buildBoard();
    gComps = el('g', {}, gWorld);
    gWires = el('g', {}, gWorld);
    gTop = el('g', {}, gWorld);
    hoverRing = el('circle', { r: 7.5, fill: 'none', stroke: '#ECEAE4', 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' }, gTop);
    tempWire = el('path', { fill: 'none', stroke: '#ECEAE4', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 8', opacity: 0, 'pointer-events': 'none' }, gTop);

    trashEl = document.createElement('div'); trashEl.className = 'cs2-trash';
    trashEl.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
    stage.appendChild(trashEl);
    const hint = document.createElement('div'); hint.className = 'cs2-hint';
    hint.textContent = T('Glisse un trou vers un autre pour tirer un fil. Touche un fil pour le retirer. Maintiens le bouton rouge.', 'Drag from one hole to another to add a wire. Tap a wire to remove it. Hold the red button.');
    stage.appendChild(hint);
    setTimeout(() => { hint.style.opacity = '0'; }, 7000);

    compNodes = new Map(); wireNodes = new Map();
    buildBattery();
    buildArduino();
    setupCodePanel();
    root.querySelector('.cs2-bar').addEventListener('click', onToolbar);
    bindPointer();
    new ResizeObserver(() => fitView(false)).observe(stage);
    fitView(true);
    refresh(true);
    cancelAnimationFrame(rafId); lastT = 0; rafId = requestAnimationFrame(tick);
  }

  function buildDefs() {
    const defs = el('defs', {}, svg);
    const grid = el('pattern', { id: 'cs2-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 1, cy: 1, r: 1, fill: '#1c1f23' }, grid);
    const blur = el('filter', { id: 'cs2-blur', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
    el('feGaussianBlur', { stdDeviation: 7 }, blur);
    const board = el('linearGradient', { id: 'cs2-board', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#f3efe4' }, board); el('stop', { offset: 1, 'stop-color': '#e3ddcd' }, board);
    const bat = el('linearGradient', { id: 'cs2-bat', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#1b1d20' }, bat); el('stop', { offset: .5, 'stop-color': '#2b2f34' }, bat); el('stop', { offset: 1, 'stop-color': '#17191b' }, bat);
    const metal = el('linearGradient', { id: 'cs2-metal', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#d9dde1' }, metal); el('stop', { offset: 1, 'stop-color': '#8d949b' }, metal);
    el('rect', { x: -5000, y: -5000, width: 10000, height: 10000, fill: 'url(#cs2-grid)' }, svg);
  }

  function buildBoard() {
    const g = el('g', { 'pointer-events': 'none' }, gWorld);
    el('rect', { x: BB.x, y: BB.y + 4, width: BB_W, height: BB_H, rx: 10, fill: '#000', opacity: .35 }, g);
    el('rect', { x: BB.x, y: BB.y, width: BB_W, height: BB_H, rx: 10, fill: 'url(#cs2-board)' }, g);
    // centre channel
    const chY = (holeY(6) + holeY(7)) / 2;
    el('rect', { x: BB.x + 6, y: chY - 5, width: BB_W - 12, height: 10, rx: 3, fill: '#d6cfbc' }, g);
    // rail stripes
    for (const [r, col] of [[0, '#e5484d'], [1, '#3e63dd'], [12, '#e5484d'], [13, '#3e63dd']]) {
      const y = holeY(r) + (r === 0 || r === 12 ? -11 : 11);
      el('line', { x1: BB.x + 14, y1: y, x2: BB.x + BB_W - 14, y2: y, stroke: col, 'stroke-width': 2, opacity: .75 }, g);
    }
    // holes
    for (let r = 0; r < 14; r++) for (let c = 0; c < COLS; c++) {
      el('rect', { x: holeX(c) - 3.6, y: holeY(r) - 3.6, width: 7.2, height: 7.2, rx: 1.6, fill: '#3b3a36' }, g);
    }
    // labels
    const lab = (x, y, t, fill = '#9a937f') => { const e = el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 9, 'font-family': 'Inter, sans-serif', fill }, g); e.textContent = t; };
    for (let r = 0; r < 14; r++) { lab(BB.x + 12, holeY(r), ROW_NAMES[r], isRail(r) ? (r % 2 === 0 ? '#e5484d' : '#3e63dd') : '#9a937f'); lab(BB.x + BB_W - 12, holeY(r), ROW_NAMES[r], isRail(r) ? (r % 2 === 0 ? '#e5484d' : '#3e63dd') : '#9a937f'); }
    for (let c = 0; c < COLS; c += 5) { lab(holeX(c), holeY(2) - 14, String(c + 1)); }
  }

  function buildBattery() {
    const g = el('g', { class: 'part', 'data-battery': '1' }, gComps);
    el('rect', { x: 2, y: 4, width: 66, height: 116, rx: 9, fill: '#000', opacity: .35 }, g);
    el('rect', { x: 0, y: 0, width: 66, height: 116, rx: 9, fill: 'url(#cs2-bat)' }, g);
    el('rect', { x: 0, y: 0, width: 66, height: 30, rx: 9, fill: '#c9a25e' }, g);
    el('rect', { x: 0, y: 20, width: 66, height: 10, fill: '#c9a25e' }, g);
    const t = el('text', { x: 33, y: 72, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, 'font-family': 'Inter, sans-serif', fill: '#ECEAE4' }, g); t.textContent = '9V';
    const t2 = el('text', { x: 33, y: 92, 'text-anchor': 'middle', 'font-size': 8.5, 'letter-spacing': 1.5, 'font-family': 'Inter, sans-serif', fill: '#8b9096' }, g); t2.textContent = 'BATTERY';
    // terminals
    el('rect', { x: 10, y: -12, width: 16, height: 12, rx: 3, fill: 'url(#cs2-metal)' }, g);
    el('circle', { cx: 48, cy: -6, r: 8, fill: 'url(#cs2-metal)' }, g);
    el('circle', { cx: 48, cy: -6, r: 4, fill: '#9aa1a8' }, g);
    const tp = el('text', { x: 48, y: 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#5c2a14' }, g); tp.textContent = '+';
    const tn = el('text', { x: 18, y: 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#5c2a14' }, g); tn.textContent = '−';
    // pin hit targets
    el('circle', { cx: 48, cy: -6, r: 11, fill: 'transparent', class: 'pin', 'data-pin': 'bat+' }, g);
    el('circle', { cx: 18, cy: -6, r: 11, fill: 'transparent', class: 'pin', 'data-pin': 'bat-' }, g);
    batteryNode = g;
  }

  // ---------- component visuals ----------
  function buildComp(c) {
    const g = el('g', { class: 'part', 'data-comp': c.id });
    const node = { g, parts: {} };
    if (c.type === 'led') {
      el('path', { d: `M3 0 V-14 M${P - 3} 0 V-10 Q ${P - 3} -14 ${P - 5} -16`, stroke: '#b9c0c7', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, g);
      node.parts.glow = el('circle', { cx: P / 2, cy: -34, r: 18, fill: '#fff', opacity: 0, filter: 'url(#cs2-blur)', 'pointer-events': 'none' }, g);
      el('rect', { x: P / 2 - 11, y: -20, width: 22, height: 5, rx: 1.5, fill: '#000', opacity: .25 }, g);
      node.parts.dome = el('path', { d: `M${P / 2 - 10} -18 V-34 a10 10 0 0 1 20 0 V-18 Z`, fill: '#5c1a17' }, g);
      node.parts.shine = el('path', { d: `M${P / 2 - 6} -22 V-33 a6 6 0 0 1 5 -6`, stroke: '#fff', 'stroke-width': 2, fill: 'none', opacity: .35, 'stroke-linecap': 'round' }, g);
      node.parts.burn = el('text', { x: P / 2, y: -50, 'text-anchor': 'middle', 'font-size': 12, opacity: 0 }, g); node.parts.burn.textContent = '💨';
      el('rect', { x: -6, y: -46, width: P + 12, height: 52, fill: 'transparent' }, g);
    } else if (c.type === 'resistor') {
      el('path', { d: `M0 0 V-8 H${4 * P} V0`, stroke: '#b9c0c7', 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' }, g);
      el('rect', { x: 2 * P - 22, y: -15, width: 44, height: 14, rx: 7, fill: '#e1c79a', stroke: '#b89a66', 'stroke-width': 1 }, g);
      node.parts.bands = [0, 1, 2, 3].map(i => el('rect', { x: 2 * P - 14 + i * 7 + (i === 3 ? 6 : 0), y: -15, width: 3.5, height: 14, fill: '#000' }, g));
      node.parts.label = el('text', { x: 2 * P, y: -21, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600, 'font-family': 'Inter, sans-serif', fill: '#c9cdd1' }, g);
      el('rect', { x: 2 * P - 26, y: -32, width: 52, height: 34, fill: 'transparent' }, g);
    } else if (c.type === 'motor') {
      el('path', { d: `M0 0 V-12 M${2 * P} 0 V-12`, stroke: '#b9c0c7', 'stroke-width': 2, fill: 'none' }, g);
      el('rect', { x: P - 20, y: -22, width: 40, height: 12, rx: 3, fill: '#2b2f34' }, g);
      el('circle', { cx: P, cy: -46, r: 25, fill: '#24272b', stroke: '#3a3f45', 'stroke-width': 2 }, g);
      node.parts.rotor = el('g', {}, g);
      for (let k = 0; k < 3; k++) el('rect', { x: P - 2.5, y: -66, width: 5, height: 20, rx: 2.5, fill: '#8b9096', transform: `rotate(${k * 120} ${P} -46)` }, node.parts.rotor);
      el('circle', { cx: P, cy: -46, r: 5, fill: '#c9a25e' }, g);
    } else if (c.type === 'button') {
      el('path', { d: `M0 0 V-8 M${2 * P} 0 V-8`, stroke: '#b9c0c7', 'stroke-width': 2, fill: 'none' }, g);
      el('rect', { x: P - 15, y: -32, width: 30, height: 26, rx: 4, fill: '#1d2023', stroke: '#33373c' }, g);
      for (const [x, y] of [[P - 11, -28], [P + 11, -28], [P - 11, -10], [P + 11, -10]]) el('circle', { cx: x, cy: y, r: 1.6, fill: '#55595e' }, g);
      node.parts.cap = el('circle', { cx: P, cy: -19, r: 9, fill: '#e5484d', 'data-btn': c.id, style: 'cursor:pointer' }, g);
    }
    // lead pins (for wiring when not on the board)
    node.parts.pins = PARTS[c.type].leads.map(([dx, dy], i) => el('circle', { cx: dx, cy: dy, r: 4, fill: '#d0d5da', class: 'pin', 'data-pin': `L:${c.id}:${i}` }, g));
    gComps.appendChild(g);
    compNodes.set(c.id, node);
    return node;
  }

  const BAND = ['#000', '#7a4a1d', '#d42a1f', '#f07b18', '#f5d020', '#2e9e3f', '#2a5fd6', '#7b3fb8', '#888', '#fff'];
  function resistorBands(v) {
    let exp = 0, n = v; while (n >= 100) { n /= 10; exp++; }
    const d = String(Math.round(n)).padStart(2, '0');
    return [BAND[+d[0]], BAND[+d[1]], BAND[exp], '#c9a25e'];
  }
  const fmtOhm = v => (v >= 1000 ? `${v / 1000}kΩ` : `${v}Ω`);

  function updateCompVisual(c) {
    const node = compNodes.get(c.id) || buildComp(c);
    node.g.setAttribute('transform', `translate(${c.pos.x} ${c.pos.y})`);
    node.parts.pins.forEach(p => p.setAttribute('opacity', c.snap ? 0 : 1));
    if (c.type === 'led') {
      const col = LED_COLORS[c.color];
      const burnt = state.burnt[c.id];
      const i = sim.leds[c.id] || 0;
      const k = burnt ? 0 : Math.min(1, i / 0.02);
      node.parts.dome.setAttribute('fill', burnt ? '#3a3a3a' : (k > 0.02 ? mix(col.off, col.on, 0.35 + 0.65 * k) : col.off));
      node.parts.glow.setAttribute('fill', col.glow);
      node.parts.glow.setAttribute('opacity', (k * 0.95).toFixed(3));
      node.parts.burn.setAttribute('opacity', burnt ? 1 : 0);
    } else if (c.type === 'resistor') {
      resistorBands(c.value).forEach((col, i) => node.parts.bands[i].setAttribute('fill', col));
      node.parts.label.textContent = fmtOhm(c.value);
    } else if (c.type === 'button') {
      node.parts.cap.setAttribute('r', c.pressed ? 7.5 : 9);
      node.parts.cap.setAttribute('fill', c.pressed ? '#b8383c' : '#e5484d');
    }
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
    const [r1, g1, b1] = ch(pa), [r2, g2, b2] = ch(pb);
    const h = x => Math.round(x).toString(16).padStart(2, '0');
    return '#' + h(r1 + (r2 - r1) * t) + h(g1 + (g2 - g1) * t) + h(b1 + (b2 - b1) * t);
  }

  function wirePath(p1, p2) {
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const lift = Math.min(70, 14 + d * 0.28);
    return `M${p1.x} ${p1.y} C${p1.x} ${p1.y - lift} ${p2.x} ${p2.y - lift} ${p2.x} ${p2.y}`;
  }

  function updateWires() {
    const live = new Set();
    for (const w of state.wires) {
      live.add(w.id);
      let n = wireNodes.get(w.id);
      if (!n) {
        const g = el('g', { class: 'wire', 'data-wire': w.id }, gWires);
        n = { g, under: el('path', { fill: 'none', stroke: '#000', 'stroke-opacity': .45, 'stroke-width': 7.5, 'stroke-linecap': 'round' }, g),
              core: el('path', { class: 'wire-core', fill: 'none', stroke: w.color, 'stroke-width': 5, 'stroke-linecap': 'round' }, g),
              hit: el('path', { fill: 'none', stroke: 'transparent', 'stroke-width': 16 }, g),
              e1: el('circle', { r: 3.2, fill: '#c9cdd1' }, g), e2: el('circle', { r: 3.2, fill: '#c9cdd1' }, g) };
        wireNodes.set(w.id, n);
      }
      const p1 = pinPos(w.from), p2 = pinPos(w.to); if (!p1 || !p2) continue;
      const d = wirePath(p1, p2);
      n.under.setAttribute('d', d); n.core.setAttribute('d', d); n.hit.setAttribute('d', d);
      n.e1.setAttribute('cx', p1.x); n.e1.setAttribute('cy', p1.y); n.e2.setAttribute('cx', p2.x); n.e2.setAttribute('cy', p2.y);
    }
    for (const [id, n] of wireNodes) if (!live.has(id)) { n.g.remove(); wireNodes.delete(id); }
  }

  // full refresh after a topology change; cheap enough to run on every drop/press
  function refresh(topologyChanged = true) {
    if (topologyChanged) {
      computeSnaps();
      sim = simulate();
      if (sim.burntNow.length) { sim.burntNow.forEach(id => (state.burnt[id] = true)); sim = simulate(); }
    }
    batteryNode.setAttribute('transform', `translate(${state.battery.x} ${state.battery.y})`);
    updateArduinoVisual();
    const live = new Set(state.comps.map(c => c.id));
    for (const [id, n] of compNodes) if (!live.has(id)) { n.g.remove(); compNodes.delete(id); }
    state.comps.forEach(updateCompVisual);
    updateWires();
    renderStatus();
  }

  function renderStatus() {
    const chips = [];
    if (sim.short) chips.push(`<span class="cs2-chip warn">⚠ ${T('Court-circuit : la pile débite', 'Short circuit: battery draws')} ${sim.batI.toFixed(1)} A</span>`);
    for (const c of state.comps) {
      if (c.type === 'led') {
        const col = LED_COLORS[c.color].name[lang()];
        if (state.burnt[c.id]) chips.push(`<span class="cs2-chip warn">${T('LED', 'LED')} ${col} ${T('grillée : ajoute une résistance (touche-la pour la remplacer)', 'burnt: add a resistor (tap it to replace)')}</span>`);
        else { const ma = (sim.leds[c.id] || 0) * 1000; if (ma > 0.5) chips.push(`<span class="cs2-chip ok">LED ${col} <b>${ma.toFixed(0)} mA</b></span>`); }
      }
      if (c.type === 'motor') { const a = Math.abs(sim.motors[c.id] || 0); if (a > 0.01) chips.push(`<span class="cs2-chip ok">${T('Moteur', 'Motor')} <b>${(a * 1000).toFixed(0)} mA</b></span>`); }
    }
    if (state.arduino) {
      for (const n of ARD_PINS) { const i = Math.abs(sim.pinI[n] || 0); if (i > I_PIN_MAX) chips.push(`<span class="cs2-chip warn">D${n} ${T('dépasse 40 mA : ajoute une résistance', 'is over 40 mA: add a resistor')}</span>`); }
      chips.push(`<span class="cs2-chip ${ard.running ? 'ok' : ''}">Arduino ${ard.running ? T('en marche', 'running') : T('à l\'arrêt', 'stopped')}</span>`);
    }
    if (!chips.length) chips.push(`<span>${T('Circuit ouvert : relie le + de la pile à une LED et sa résistance, puis reviens au −.', 'Open circuit: connect battery + through a resistor and an LED, then back to −.')}</span>`);
    else chips.unshift(`<span>${T('Pile', 'Battery')} <b>${(Math.max(0, sim.batI) * 1000).toFixed(0)} mA</b></span>`);
    statusEl.innerHTML = chips.join('');
  }

  // ---------- animation loop (motors) ----------
  function tick(t) {
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
    for (const c of state.comps) if (c.type === 'motor') {
      const i = sim.motors[c.id] || 0;
      motorAngles[c.id] = ((motorAngles[c.id] || 0) + i * 4200 * dt) % 360;
      const n = compNodes.get(c.id); if (n) n.parts.rotor.setAttribute('transform', `rotate(${motorAngles[c.id]} ${P} -46)`);
    }
    if (root && root.isConnected) rafId = requestAnimationFrame(tick);
  }

  // ---------- view (pan / zoom) ----------
  let view = { x: 0, y: 0, w: 900 };
  function applyView() {
    const r = svg.getBoundingClientRect(); const h = view.w * (r.height / Math.max(1, r.width));
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${h}`);
  }
  function fitView(force) {
    if (!svg) return;
    if (!force && state.view) { view = { ...state.view }; applyView(); return; }
    const r = svg.getBoundingClientRect(); if (!r.width) return;
    const minX = state.arduino ? Math.min(20, state.arduino.x - 18) : 20, maxX = BB.x + BB_W + 20, minY = BB.y - 70;
    const maxY = Math.max(BB.y + BB_H + 20, state.arduino ? state.arduino.y + ARD_H + 14 : 0);
    const w = maxX - minX, h = maxY - minY;
    const scale = Math.max(w / r.width, h / r.height);
    view.w = r.width * scale;
    view.x = minX - (view.w - w) / 2;
    view.y = minY - (r.height * scale - h) / 2;
    state.view = { ...view };
    applyView();
  }
  function zoomAt(f, cx, cy) {
    const r = svg.getBoundingClientRect();
    const p = toWorld(cx, cy);
    const nw = Math.max(260, Math.min(2400, view.w * f));
    const k = nw / view.w;
    view.x = p.x - (p.x - view.x) * k;
    view.y = p.y - (p.y - view.y) * k;
    view.w = nw; state.view = { ...view }; applyView();
  }
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect(); const s = view.w / r.width;
    return { x: view.x + (cx - r.left) * s, y: view.y + (cy - r.top) * s };
  }

  // ---------- toolbar ----------
  function onToolbar(e) {
    const b = e.target.closest('button'); if (!b) return;
    const r = svg.getBoundingClientRect();
    if (b.dataset.add) {
      const type = b.dataset.add;
      const center = toWorld(r.left + r.width / 2, r.top + r.height * 0.18);
      const c = { id: type[0] + uid++, type, pos: { x: center.x - 20 + (Math.random() * 60 - 30), y: Math.max(center.y, BB.y - 30) } };
      if (type === 'led') c.color = Math.floor(Math.random() * LED_COLORS.length);
      if (type === 'resistor') c.value = 220;
      // drop it just above the board, off the holes, so it floats until placed
      c.pos.y = BB.y - 18;
      state.comps.push(c); refresh(true);
    }
    const act = b.dataset.act;
    if (act === 'zoomin') zoomAt(0.8, r.left + r.width / 2, r.top + r.height / 2);
    if (act === 'zoomout') zoomAt(1.25, r.left + r.width / 2, r.top + r.height / 2);
    if (act === 'fit') fitView(true);
    if (act === 'clear') { stopCode(); state.comps = []; state.wires = []; state.burnt = {}; state.arduino = null; refresh(true); }
    if (act === 'reset') resetSimulator();
    if (act === 'arduino') {
      toggleCode(true);
      if (!state.arduino) loadArduinoDemo();
    }
  }

  // ---------- pointer interactions ----------
  let gesture = null; const pointers = new Map();

  function pinAt(x, y, exclude) {
    let best = null, bd = 13;
    const cand = ['bat+', 'bat-'];
    if (state.arduino) ARD_HEADER.forEach(n => cand.push('A:' + n));
    for (const c of state.comps) if (!c.snap) PARTS[c.type].leads.forEach((_, i) => cand.push(`L:${c.id}:${i}`));
    for (const id of cand) { if (id === exclude) continue; const p = pinPos(id); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = id; } }
    if (best) return best;
    const h = nearestHole(x, y, 12); return h && h.id !== exclude ? h.id : null;
  }

  function bindPointer() {
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    svg.addEventListener('pointerleave', () => hoverRing.setAttribute('opacity', 0));
  }

  function onDown(e) {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { // pinch
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), w: view.w };
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    const t = e.target;
    const start = { x: e.clientX, y: e.clientY };

    if (t.dataset && t.dataset.btn) { // push button: hold to close
      const c = state.comps.find(k => k.id === t.dataset.btn); c.pressed = true; refresh(true);
      gesture = { type: 'button', comp: c, start }; return;
    }
    const pin = (t.dataset && t.dataset.pin) || (!t.closest('.part') && !t.closest('.wire') ? pinAt(w.x, w.y) : null);
    if (pin) {
      if (gesture && gesture.type === 'pending') { addWire(gesture.from, pin); gesture = null; tempWire.setAttribute('opacity', 0); return; }
      gesture = { type: 'wire', from: pin, start, moved: false };
      return;
    }
    const wireG = t.closest && t.closest('.wire');
    if (wireG) { gesture = { type: 'wireTap', id: +wireG.dataset.wire || wireG.dataset.wire, start }; return; }
    const part = t.closest && t.closest('.part');
    if (part) {
      if (part.dataset.battery) gesture = { type: 'battery', off: { x: w.x - state.battery.x, y: w.y - state.battery.y }, start, moved: false };
      else if (part.dataset.arduino) gesture = { type: 'arduino', off: { x: w.x - state.arduino.x, y: w.y - state.arduino.y }, start, moved: false };
      else {
        const c = state.comps.find(k => k.id === part.dataset.comp);
        gesture = { type: 'comp', comp: c, off: { x: w.x - c.pos.x, y: w.y - c.pos.y }, start, moved: false, node: part };
        gComps.appendChild(part); // bring to front
      }
      return;
    }
    if (gesture && gesture.type === 'pending') { gesture = null; tempWire.setAttribute('opacity', 0); }
    gesture = { type: 'pan', start, vx: view.x, vy: view.y };
  }

  let moveQueued = null;
  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moveQueued = e;
    if (!onMove.raf) onMove.raf = requestAnimationFrame(() => { onMove.raf = 0; handleMove(moveQueued); });
  }

  function handleMove(e) {
    const w = toWorld(e.clientX, e.clientY);
    // hover feedback for pins / holes
    const hp = (!gesture || gesture.type === 'wire' || gesture.type === 'pending') ? pinAt(w.x, w.y, gesture && gesture.from) : null;
    if (hp) { const p = pinPos(hp); hoverRing.setAttribute('cx', p.x); hoverRing.setAttribute('cy', p.y); hoverRing.setAttribute('opacity', 1); }
    else hoverRing.setAttribute('opacity', 0);

    if (!gesture) return;
    const dist = Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y);
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = gesture.d / Math.max(1, d);
      const nw = Math.max(260, Math.min(2400, gesture.w * f));
      zoomAt(nw / view.w, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (gesture.type === 'pan') {
      const r = svg.getBoundingClientRect(); const s = view.w / r.width;
      view.x = gesture.vx - (e.clientX - gesture.start.x) * s; view.y = gesture.vy - (e.clientY - gesture.start.y) * s;
      state.view = { ...view }; applyView(); return;
    }
    if (gesture.type === 'wire' || gesture.type === 'pending') {
      if (gesture.type === 'wire' && dist > 6) gesture.moved = true;
      const p1 = pinPos(gesture.from); const p2 = hp ? pinPos(hp) : w;
      tempWire.setAttribute('d', wirePath(p1, p2)); tempWire.setAttribute('opacity', gesture.moved || gesture.type === 'pending' ? 1 : 0);
      return;
    }
    if (gesture.type === 'arduino') {
      state.arduino = { x: w.x - gesture.off.x, y: w.y - gesture.off.y };
      updateArduinoVisual(); updateWires(); return;
    }
    if (gesture.type === 'battery') {
      if (dist > 4) gesture.moved = true;
      state.battery = { x: w.x - gesture.off.x, y: w.y - gesture.off.y };
      batteryNode.setAttribute('transform', `translate(${state.battery.x} ${state.battery.y})`);
      updateWires(); return;
    }
    if (gesture.type === 'comp') {
      if (dist > 4) { gesture.moved = true; gesture.node.classList.add('dragging'); trashEl.classList.add('show'); }
      const c = gesture.comp;
      c.pos = { x: w.x - gesture.off.x, y: w.y - gesture.off.y };
      // live snap preview without a full simulation
      const occ = new Set(); state.comps.forEach(k => { if (k !== c && k.snap) k.snap.holes.forEach(h => occ.add(h)); });
      const sn = computeSnap(c, occ);
      const shown = sn ? sn.pos : c.pos;
      gesture.node.setAttribute('transform', `translate(${shown.x} ${shown.y})`);
      const tr = trashEl.getBoundingClientRect();
      gesture.overTrash = e.clientX >= tr.left - 10 && e.clientX <= tr.right + 10 && e.clientY >= tr.top - 10 && e.clientY <= tr.bottom + 10;
      trashEl.classList.toggle('hot', gesture.overTrash);
      // wires follow the preview position
      const saved = c.pos; c.pos = shown; updateWires(); c.pos = saved;
    }
  }

  function onUp(e) {
    // flush the last move synchronously so a fast drag is never lost to a skipped frame
    if (gesture && gesture.type !== 'pinch') { if (onMove.raf) { cancelAnimationFrame(onMove.raf); onMove.raf = 0; } handleMove(e); }
    pointers.delete(e.pointerId);
    if (!gesture) return;
    const g = gesture;
    if (g.type === 'pinch') { if (pointers.size < 2) gesture = null; return; }
    const w = toWorld(e.clientX, e.clientY);
    if (g.type === 'button') { g.comp.pressed = false; gesture = null; refresh(true); return; }
    if (g.type === 'wire') {
      const target = pinAt(w.x, w.y, g.from);
      if (g.moved && target) { addWire(g.from, target); gesture = null; tempWire.setAttribute('opacity', 0); }
      else if (!g.moved) { gesture = { type: 'pending', from: g.from, start: g.start }; const p = pinPos(g.from); tempWire.setAttribute('d', wirePath(p, p)); }
      else { gesture = null; tempWire.setAttribute('opacity', 0); }
      return;
    }
    if (g.type === 'pending') return;
    if (g.type === 'wireTap') {
      if (Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < 8) { state.wires = state.wires.filter(x => String(x.id) !== String(g.id)); refresh(true); }
      gesture = null; return;
    }
    if (g.type === 'battery' || g.type === 'arduino') {
      if (g.type === 'arduino' && Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < 6) toggleCode(true);
      gesture = null; refresh(false); return;
    }
    if (g.type === 'comp') {
      g.node.classList.remove('dragging'); trashEl.classList.remove('show', 'hot');
      const c = g.comp;
      if (g.overTrash) {
        state.comps = state.comps.filter(k => k !== c);
        state.wires = state.wires.filter(x => !x.from.startsWith(`L:${c.id}:`) && !x.to.startsWith(`L:${c.id}:`));
        delete state.burnt[c.id];
      } else if (!g.moved) { // tap: change value / colour / replace burnt LED
        if (c.type === 'resistor') c.value = RES_VALUES[(RES_VALUES.indexOf(c.value) + 1) % RES_VALUES.length];
        if (c.type === 'led') { if (state.burnt[c.id]) delete state.burnt[c.id]; else c.color = (c.color + 1) % LED_COLORS.length; }
      }
      gesture = null; refresh(true); return;
    }
    gesture = null;
  }

  // ---------- Arduino board, editor and runner ----------
  let arduinoNode, ledL, codeEl, consoleEl, editorEl, progEl, needsSim = false;

  function buildArduino() {
    const g = el('g', { class: 'part', 'data-arduino': '1' }, gComps);
    el('rect', { x: 2, y: 5, width: ARD_W, height: ARD_H, rx: 8, fill: '#000', opacity: .35 }, g);
    el('rect', { x: 0, y: 0, width: ARD_W, height: ARD_H, rx: 8, fill: '#00878f' }, g);
    el('rect', { x: -10, y: 50, width: 22, height: 24, rx: 3, fill: 'url(#cs2-metal)' }, g);           // USB
    el('rect', { x: 52, y: 44, width: 50, height: 18, rx: 2, fill: '#111315' }, g);                   // MCU
    for (let k = 0; k < 7; k++) { el('rect', { x: 55 + k * 7, y: 40, width: 2.5, height: 4, fill: '#c9cdd1' }, g); el('rect', { x: 55 + k * 7, y: 62, width: 2.5, height: 4, fill: '#c9cdd1' }, g); }
    const t = el('text', { x: 78, y: 82, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, 'font-family': 'Inter, sans-serif', fill: '#e6f4f4' }, g); t.textContent = 'ARDUINO UNO';
    el('rect', { x: 4, y: -7, width: ARD_W - 8, height: 14, rx: 3, fill: '#111315' }, g);             // header
    ARD_HEADER.forEach(name => {
      const o = ardPinOffset(name);
      el('rect', { x: o.x - 3, y: o.y - 3, width: 6, height: 6, rx: 1, fill: '#3b3a36' }, g);
      const lb = el('text', { x: o.x, y: 18, 'text-anchor': 'middle', 'font-size': 7.5, 'font-weight': 600, 'font-family': 'Inter, sans-serif', fill: name === 'GND' ? '#bfe3e5' : name === '5V' ? '#ffd1c9' : '#e6f4f4' }, g);
      lb.textContent = name.replace('D', ARD_PWM.has(+name.slice(1)) ? '~' : '');
      el('circle', { cx: o.x, cy: o.y, r: 7, fill: 'transparent', class: 'pin', 'data-pin': 'A:' + name }, g);
    });
    ledL = el('circle', { cx: 24, cy: 34, r: 3.5, fill: '#5a4a16' }, g);
    const tl = el('text', { x: 31, y: 37, 'font-size': 7, 'font-family': 'Inter, sans-serif', fill: '#e6f4f4' }, g); tl.textContent = 'L';
    el('circle', { cx: 24, cy: 24, r: 3, fill: '#4dff8f' }, g);                                       // power LED
    const tp = el('text', { x: 31, y: 27, 'font-size': 7, 'font-family': 'Inter, sans-serif', fill: '#e6f4f4' }, g); tp.textContent = 'ON';
    arduinoNode = g;
  }

  function updateArduinoVisual() {
    if (!arduinoNode) return;
    if (!state.arduino) { arduinoNode.setAttribute('display', 'none'); return; }
    arduinoNode.removeAttribute('display');
    arduinoNode.setAttribute('transform', `translate(${state.arduino.x} ${state.arduino.y})`);
    const on13 = ard.modes[13] === 1 && (ard.out[13] || 0) > 0;
    ledL.setAttribute('fill', on13 ? '#ffd23f' : '#5a4a16');
  }

  function setupCodePanel() {
    codeEl = root.querySelector('.cs2-code'); consoleEl = root.querySelector('.cs2-console');
    editorEl = root.querySelector('.cs2-editor'); progEl = root.querySelector('.cs2-prog');
    editorEl.value = state.code; progEl.value = state.program || 'traffic';
    editorEl.addEventListener('input', () => { state.code = editorEl.value; });
    editorEl.addEventListener('keydown', e => { // Tab inserts two spaces, Ctrl/Cmd+Enter uploads
      if (e.key === 'Tab') { e.preventDefault(); const a = editorEl.selectionStart; editorEl.setRangeText('  ', a, editorEl.selectionEnd, 'end'); state.code = editorEl.value; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runCode(); }
    });
    progEl.addEventListener('change', () => { state.program = progEl.value; state.code = PROGRAMS[progEl.value].code; editorEl.value = state.code; if (ard.running) runCode(); });
    codeEl.addEventListener('click', e => {
      const b = e.target.closest('[data-code]'); if (!b) return;
      if (b.dataset.code === 'run') runCode();
      if (b.dataset.code === 'stop') { stopCode(); log(T('Programme arrêté.', 'Program stopped.')); }
      if (b.dataset.code === 'close') toggleCode(false);
      if (b.dataset.code === 'demo') loadArduinoDemo();
    });
    if (ard.panelOpen) toggleCode(true);
    log(T('Écris ton code puis Téléverser (Ctrl+Entrée). Broches : D8 à D13, PWM sur ~9 ~10 ~11.', 'Write your code, then Upload (Ctrl+Enter). Pins: D8 to D13, PWM on ~9 ~10 ~11.'));
  }

  function toggleCode(open) {
    ard.panelOpen = open; if (!codeEl) return;
    codeEl.hidden = !open; root.classList.toggle('code-open', open);
    requestAnimationFrame(() => applyView());
  }

  function log(msg, isErr) { if (consoleEl) { consoleEl.textContent = msg; consoleEl.classList.toggle('err', !!isErr); } }

  const io = {
    pins: ARD_PINS,
    pinMode: (p, m) => { ard.modes[p] = m === 1 ? 1 : 0; needsSim = true; },
    write: (p, v) => {
      if (!ARD_PWM.has(p) && v > 0 && v < 255) v = v >= 128 ? 255 : 0; // analogWrite on a non-PWM pin behaves digitally
      if (ard.modes[p] !== 1 && !ard.warned) { ard.warned = true; log(T(`Astuce : ajoute pinMode(${p}, OUTPUT) dans setup().`, `Tip: add pinMode(${p}, OUTPUT) in setup().`)); }
      ard.out[p] = v; needsSim = true;
    },
  };

  function runCode() {
    stopCode(true);
    if (!state.arduino) { state.arduino = { x: 8, y: 300 }; }
    ard.modes = {}; ard.out = {}; ard.warned = false;
    try { ard.it = ArduinoLang.createProgram(state.code, io); }
    catch (err) { log(`${T('Ligne', 'Line')} ${err.line || '?'} : ${err.message}`, true); refresh(true); return; }
    ard.running = true; log(T('Téléversé. Le programme tourne.', 'Uploaded. The program is running.'));
    stepCode();
  }

  function stepCode() {
    if (!ard.running) return;
    if (!root || !root.isConnected) { stopCode(true); return; }
    let r;
    try { r = ard.it.next(); }
    catch (err) { ard.running = false; log(`${T('Ligne', 'Line')} ${err.line || '?'} : ${err.message}`, true); refresh(true); return; }
    if (needsSim) { needsSim = false; refresh(true); }
    if (r.done) { ard.running = false; renderStatus(); return; }
    ard.timer = setTimeout(stepCode, Math.max(0, r.value));
  }

  function stopCode(silent) {
    clearTimeout(ard.timer); ard.running = false; ard.it = null;
    ard.modes = {}; ard.out = {};
    if (!silent && root) refresh(true);
  }

  function loadArduinoDemo() {
    stopCode(true);
    const hole = (c, r) => ({ x: holeX(c), y: holeY(r) });
    const W = (from, to, color) => ({ id: 'w' + uid++, from, to, color });
    state.arduino = { x: 8, y: 300 };
    state.comps = [
      { id: 'ar1', type: 'resistor', value: 220, pos: hole(3, 2) }, { id: 'al1', type: 'led', color: 0, pos: hole(7, 6) },
      { id: 'ar2', type: 'resistor', value: 220, pos: hole(11, 2) }, { id: 'al2', type: 'led', color: 2, pos: hole(15, 6) },
      { id: 'ar3', type: 'resistor', value: 220, pos: hole(19, 2) }, { id: 'al3', type: 'led', color: 1, pos: hole(23, 6) },
    ];
    state.wires = [
      W('A:D13', 'H:3:4', WIRE_COLORS[0]), W('H:8:5', 'H:8:1', '#2b2f34'),
      W('A:D12', 'H:11:4', WIRE_COLORS[3]), W('H:16:5', 'H:16:1', '#2b2f34'),
      W('A:D11', 'H:19:4', WIRE_COLORS[2]), W('H:24:5', 'H:24:1', '#2b2f34'),
      W('A:GND', 'H:0:1', '#2b2f34'),
    ];
    state.burnt = {};
    state.program = 'traffic'; state.code = PROGRAMS.traffic.code;
    if (editorEl) { editorEl.value = state.code; progEl.value = 'traffic'; }
    compNodes.forEach(n => n.g.remove()); compNodes.clear(); wireNodes.forEach(n => n.g.remove()); wireNodes.clear();
    fitView(true); refresh(true); runCode();
  }

  function addWire(a, b) {
    if (!a || !b || a === b) return;
    if (state.wires.some(w => (w.from === a && w.to === b) || (w.from === b && w.to === a))) return;
    const color = WIRE_COLORS[state.wireColor++ % WIRE_COLORS.length];
    state.wires.push({ id: 'w' + uid++, from: a, to: b, color });
    refresh(true);
  }

  function resetSimulator() {
    stopCode();
    state = normalizeExample(exampleState());
    if (svg) { compNodes.forEach(n => n.g.remove()); compNodes.clear(); wireNodes.forEach(n => n.g.remove()); wireNodes.clear(); fitView(true); refresh(true); }
  }

  return { init, reset: resetSimulator };
})();

window.CircuitSimulator = CircuitSimulator;
