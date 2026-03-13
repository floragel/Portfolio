/**
 * Circuit Simulator - Vanilla JS Adaptation
 * Robust rendering engine with zoom, correct layering, and realistic visuals.
 * Premium interactive electronics laboratory.
 */

const CircuitSimulator = (function() {
    // --- Constants (Scaled Down) ---
    const COLS = 26;
    const ROWS_TOP = ["a", "b", "c", "d", "e"];
    const ROWS_BOT = ["f", "g", "h", "i", "j"];
    const PIN_PITCH = 18;
    const PIN_R = 3.2;   
    const BB_RAIL_H = 22; 
    const BB_GAP_Y = 16;  
    const BB_COL_LBL = 18;
    const BB_ROW_LBL = 18;
    const BB_W = BB_ROW_LBL + COLS * PIN_PITCH;
    const BB_TOP_H = BB_RAIL_H * 2 + BB_GAP_Y + ROWS_TOP.length * PIN_PITCH + BB_COL_LBL + BB_GAP_Y + ROWS_BOT.length * PIN_PITCH + BB_GAP_Y;
    const BB_H = BB_TOP_H + BB_RAIL_H * 2 + 8;
    const SNAP_DIST = 25;
    const PROXIMITY_DIST = 15; 

    const COLORS = ["#3b82f6", "#10b981", "#ef4444", "#f46c38", "#8b5cf6", "#06b6d4"];
    let colorIndex = 0;
    const nextColor = () => COLORS[colorIndex++ % COLORS.length];

    const DEFAULT_STATE = {
        bbPos: { x: 40, y: 70 },
        batPos: { x: 40, y: 5 },
        components: [
            { id: "led1", type: "led", color: "#cc2211", colorLit: "#ff4422", pos: { x: 220, y: 5 }, snap: null, leads: [ { id: "led1_anode", lx: 8, ly: 70 }, { id: "led1_cathode", lx: 26, ly: 70 } ] },
            { id: "led2", type: "led", color: "#118833", colorLit: "#44ff77", pos: { x: 280, y: 5 }, snap: null, leads: [ { id: "led2_anode", lx: 8, ly: 70 }, { id: "led2_cathode", lx: 26, ly: 70 } ] },
            { id: "motor1", type: "motor", pos: { x: 360, y: 5 }, snap: null, leads: [ { id: "motor1_a", lx: 14, ly: 75 }, { id: "motor1_b", lx: 32, ly: 75 } ] },
            { id: "btn1", type: "button", pos: { x: 480, y: 5 }, snap: null, leads: [ { id: "btn1_in", lx: 8, ly: 60 }, { id: "btn1_out", lx: 26, ly: 60 } ], pressed: false }
        ],
        wires: [],
        active: {},
        activePin: null,
        hoverPin: null,
        mousePos: { x: 0, y: 0 },
        dragTarget: null,
        dragging: false,
        nextWireId: 1,
        zoom: 1,
        viewOffset: { x: 0, y: 0 }
    };

    let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

    // --- SVG Helper ---
    function s(tag, attrs = {}, text = "") {
        const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (let k in attrs) el.setAttribute(k, attrs[k]);
        if (text) el.textContent = text;
        return el;
    }

    function bbLocal(col, row) {
        const ri = [...ROWS_TOP, ...ROWS_BOT].indexOf(row);
        const x = BB_ROW_LBL + (col - 1) * PIN_PITCH + PIN_PITCH / 2;
        let y;
        if (ri < ROWS_TOP.length) y = BB_RAIL_H * 2 + BB_GAP_Y + ri * PIN_PITCH + PIN_PITCH / 2;
        else y = BB_RAIL_H * 2 + BB_GAP_Y + ROWS_TOP.length * PIN_PITCH + BB_COL_LBL + BB_GAP_Y + (ri - ROWS_TOP.length) * PIN_PITCH + PIN_PITCH / 2;
        return { x, y };
    }

    function railLocal(side, pol, idx) {
        const x = BB_ROW_LBL + idx * PIN_PITCH + PIN_PITCH / 2;
        if (side === "top") return { x, y: pol === "+" ? BB_RAIL_H * .5 : BB_RAIL_H * 1.5 };
        return { x, y: BB_TOP_H + (pol === "+" ? BB_RAIL_H * .5 : BB_RAIL_H * 1.5) };
    }

    function findSnap2(compPos, bbPos, leads) {
        if (!leads || leads.length < 2) return null;
        const [l0, l1] = leads;
        const s0 = { x: compPos.x + l0.lx, y: compPos.y + l0.ly };
        const s1 = { x: compPos.x + l1.lx, y: compPos.y + l1.ly };
        let best = null;
        const allRows = [...ROWS_TOP, ...ROWS_BOT];
        for (let c = 1; c <= COLS - 1; c++) {
            for (const row of allRows) {
                const p0 = bbLocal(c, row); const sv0 = { x: bbPos.x + p0.x, y: bbPos.y + p0.y };
                const p1 = bbLocal(c + 1, row); const sv1 = { x: bbPos.x + p1.x, y: bbPos.y + p1.y };
                const dist = Math.max(Math.hypot(s0.x - sv0.x, s0.y - sv0.y), Math.hypot(s1.x - sv1.x, s1.y - sv1.y));
                if (!best || dist < best.dist) {
                    best = { dist, pin0: `col_${c}_${row}`, pin1: `col_${c + 1}_${row}`, snapPos: { x: sv0.x - l0.lx, y: sv0.y - l0.ly } };
                }
            }
        }
        return (best && best.dist < SNAP_DIST) ? best : null;
    }

    function getAllPins() {
        const pins = [];
        // Battery pins
        pins.push({ id: "bat_+", x: state.batPos.x + 85, y: state.batPos.y + 65 });
        pins.push({ id: "bat_-", x: state.batPos.x + 30, y: state.batPos.y + 65 });
        
        // Breadboard pins
        [...ROWS_TOP, ...ROWS_BOT].forEach(row => {
            for (let c = 1; c <= COLS; c++) {
                const l = bbLocal(c, row);
                pins.push({ id: `col_${c}_${row}`, x: state.bbPos.x + l.x, y: state.bbPos.y + l.y });
            }
        });
        [["top", "+"], ["top", "-"], ["bot", "+"], ["bot", "-"]].forEach(([side, pol]) => {
            for (let c = 1; c <= COLS; c++) {
                const l = railLocal(side, pol, c-1);
                pins.push({ id: `rail_${side}_${pol}_${c}`, x: state.bbPos.x + l.x, y: state.bbPos.y + l.y });
            }
        });

        // Component leads
        for (const comp of state.components) {
            const rp = comp.snap ? comp.snap.snapPos : comp.pos;
            for (const lead of comp.leads) {
                pins.push({ id: lead.id, x: rp.x + lead.lx, y: rp.y + lead.ly });
            }
        }
        return pins;
    }

    function findNearestPin(x, y) {
        const pins = getAllPins();
        let best = null;
        let minDist = PROXIMITY_DIST;
        for (const p of pins) {
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist) {
                minDist = d;
                best = p;
            }
        }
        return best;
    }

    function pinToSVG(pinId) {
        const pins = getAllPins();
        const p = pins.find(p => p.id === pinId);
        return p ? { x: p.x, y: p.y } : null;
    }

    function buildGraph() {
        const adj = {};
        const add = (a, b) => { if (!adj[a]) adj[a] = new Set(); if (!adj[b]) adj[b] = new Set(); adj[a].add(b); adj[b].add(a); };
        for (let c = 1; c <= COLS; c++) {
            add(`rail_top_+_${c}`, "rail_top_+_bus"); add(`rail_top_-_${c}`, "rail_top_-_bus");
            add(`rail_bot_+_${c}`, "rail_bot_+_bus"); add(`rail_bot_-_${c}`, "rail_bot_-_bus");
        }
        for (let c = 1; c <= COLS; c++) {
            for (let i = 0; i < ROWS_TOP.length - 1; i++) add(`col_${c}_${ROWS_TOP[i]}`, `col_${c}_${ROWS_TOP[i+1]}`);
            for (let i = 0; i < ROWS_BOT.length - 1; i++) add(`col_${c}_${ROWS_BOT[i]}`, `col_${c}_${ROWS_BOT[i+1]}`);
        }
        for (const w of state.wires) add(w.from, w.to);
        for (const comp of state.components) {
            if (comp.snap) { add(comp.leads[0].id, comp.snap.pin0); add(comp.leads[1].id, comp.snap.pin1); }
            if (comp.type === "button" && comp.pressed) add(comp.leads[0].id, comp.leads[1].id);
        }
        return adj;
    }

    function bfs(adj, s, e) {
        if (!adj[s] || !adj[e]) return false; if (s === e) return true;
        const vis = new Set([s]), q = [s];
        while (q.length) {
            const n = q.shift(); if (n === e) return true;
            for (const nb of adj[n]) if (!vis.has(nb)) { vis.add(nb); q.push(nb); }
        }
        return false;
    }

    function computeActive() {
        const adj = buildGraph();
        const res = {};
        for (const comp of state.components) {
            if (comp.type === "led") res[comp.id] = bfs(adj, "bat_+", comp.leads[0].id) && bfs(adj, comp.leads[1].id, "bat_-");
            else if (comp.type === "motor") res[comp.id] = (bfs(adj, "bat_+", comp.leads[0].id) && bfs(adj, comp.leads[1].id, "bat_-")) || (bfs(adj, "bat_+", comp.leads[1].id) && bfs(adj, comp.leads[0].id, "bat_-"));
        }
        state.active = res;
    }

    let svg, layer1, layer2;
    let initialized = false;

    function init(targetId) {
        const container = document.getElementById(targetId);
        if (!container) return;
        
        // Don't clear innerHTML to preserve HTML-based controls (like the Reset button)
        // Check for the main simulator SVG specifically (to avoid confusion with button icons)
        if (container.querySelector('svg.main-simulator-svg')) return;
        
        svg = s("svg", { width: "100%", height: "100%", viewBox: "0 0 800 380", class: "main-simulator-svg" });
        svg.style.background = "#070707";
        svg.style.borderRadius = "12px";
        svg.style.overflow = "hidden";
        
        const defs = s("defs");
        const pattern = s("pattern", { id: "grid", width: "30", height: "30", patternUnits: "userSpaceOnUse" });
        pattern.appendChild(s("circle", { cx: "1", cy: "1", r: "1", fill: "#222" }));
        defs.appendChild(pattern);
        
        const grad9v = s("linearGradient", { id: "grad9v", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
        grad9v.appendChild(s("stop", { offset: "0%", "stop-color": "#444" }));
        grad9v.appendChild(s("stop", { offset: "20%", "stop-color": "#222" }));
        grad9v.appendChild(s("stop", { offset: "100%", "stop-color": "#111" }));
        defs.appendChild(grad9v);

        const gradCopper = s("linearGradient", { id: "gradCopper", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
        gradCopper.appendChild(s("stop", { offset: "0%", "stop-color": "#d98c40" }));
        gradCopper.appendChild(s("stop", { offset: "50%", "stop-color": "#b87333" }));
        gradCopper.appendChild(s("stop", { offset: "100%", "stop-color": "#8b4513" }));
        defs.appendChild(gradCopper);

        const filterR = s("filter", { id: "glowR" });
        filterR.appendChild(s("feGaussianBlur", { stdDeviation: "6", result: "b" }));
        const fmR = s("feMerge"); fmR.appendChild(s("feMergeNode", { in: "b" })); fmR.appendChild(s("feMergeNode", { in: "SourceGraphic" }));
        filterR.appendChild(fmR);
        defs.appendChild(filterR);

        const filterG = s("filter", { id: "glowG" });
        filterG.appendChild(s("feGaussianBlur", { stdDeviation: "6", result: "b" }));
        const fmG = s("feMerge"); fmG.appendChild(s("feMergeNode", { in: "b" })); fmG.appendChild(s("feMergeNode", { in: "SourceGraphic" }));
        filterG.appendChild(fmG);
        defs.appendChild(filterG);

        const style = s("style", {}, `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } 
            .pin { cursor: pointer; transition: all 0.2s; }
            .pin:hover, .pin.highlight { r: 5; stroke: #00ff88; stroke-width: 2; }
            .reset-btn { cursor: pointer; opacity: 0.6; transition: all 0.2s; }
            .reset-btn:hover { opacity: 1; transform: scale(1.1); }
            .reset-btn:active { transform: scale(0.9); }
        `);
        
        layer1 = s("g"); // Interaction layer
        layer2 = s("g"); // Wires layer
        
        svg.appendChild(defs); svg.appendChild(style);
        svg.appendChild(s("rect", { width: "100%", height: "100%", fill: "url(#grid)" }));
        svg.appendChild(layer1);
        svg.appendChild(layer2);
        
        container.appendChild(svg);

        if (!initialized) {
            setupEvents();
            initialized = true;
        }
        updateViewBox();
        render();
    }

    function resetSimulator() {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        updateViewBox();
        render();
    }

    function updateViewBox() {
        if (!svg) return;
        const w = 800 * state.zoom;
        const h = 380 * state.zoom;
        const x = state.viewOffset.x + (800 - w) / 2;
        const y = state.viewOffset.y + (380 - h) / 2;
        svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    }

    function render() {
        if (!layer1 || !layer2) return;
        layer1.innerHTML = '';
        layer2.innerHTML = '';

        state.components.forEach(c => { c.snap = findSnap2(c.pos, state.bbPos, c.leads); });
        computeActive();
        const occ = new Set(); state.components.forEach(c => { if(c.snap) { occ.add(c.snap.pin0); occ.add(c.snap.pin1); } });

        // --- LAYER 0: Breadboard (Always in Background) ---
        const bb = s("g", { transform: `translate(${state.bbPos.x},${state.bbPos.y})`, style: "cursor: grab" });
        bb.appendChild(s("rect", { width: BB_W, height: BB_H, rx: "6", fill: "#f4ead2", stroke: "#dcd0b0" }));
        bb.appendChild(s("rect", { y: BB_TOP_H, width: BB_W, height: BB_COL_LBL, fill: "#efe2c2" }));
        
        [...ROWS_TOP, ...ROWS_BOT].forEach(row => {
            for (let c = 1; c <= COLS; c++) {
                const { x, y } = bbLocal(c, row); const pid = `col_${c}_${row}`;
                const circ = s("circle", { cx: x, cy: y, r: PIN_R-0.6, fill: occ.has(pid) ? "#fa9944" : (state.activePin===pid ? "#00ff88" : "#cab070"), class: `pin ${state.hoverPin===pid?'highlight':''}` });
                bb.appendChild(circ);
            }
        });
        [["top", "+"], ["top", "-"], ["bot", "+"], ["bot", "-"]].forEach(([side, pol]) => {
            for (let c = 1; c <= COLS; c++) {
                const { x, y } = railLocal(side, pol, c-1); const pid = `rail_${side}_${pol}_${c}`;
                const circ = s("circle", { cx: x, cy: y, r: PIN_R-0.6, fill: state.activePin===pid ? "#00ff88" : (pol=="+"?"#dd3333":"#333"), class: `pin ${state.hoverPin===pid?'highlight':''}` });
                bb.appendChild(circ);
            }
        });
        bb.addEventListener("mousedown", (e) => { if(!e.target.classList.contains('pin')) startDrag(e, "bb"); });
        layer1.appendChild(bb);

        // --- LAYER 1: Battery ---
        const bat = s("g", { transform: `translate(${state.batPos.x},${state.batPos.y})`, style: "cursor: grab" });
        bat.appendChild(s("rect", { width: "120", height: "55", rx: "6", fill: "url(#grad9v)", stroke: "#000", "stroke-width": "1" }));
        bat.appendChild(s("rect", { width: "120", height: "15", y: "0", rx: "6", fill: "url(#gradCopper)", opacity: "0.9" }));
        bat.appendChild(s("text", { x: "60", y: "38", "text-anchor": "middle", "font-size": "12", fill: "#fff", "font-family": "Inter, sans-serif", "font-weight": "bold", style: "pointer-events: none; opacity: 0.8" }, "9V ENERGY"));
        
        const bNeg = s("circle", { cx: "30", cy: "65", r: PIN_R, fill: state.activePin==='bat_-'?'#00ff88':'#333', stroke: "#555", "stroke-width": "1.5", class: `pin ${state.hoverPin==='bat_-'?'highlight':''}`, id: "bat_-" });
        const bPos = s("circle", { cx: "85", cy: "65", r: PIN_R, fill: state.activePin==='bat_+'?'#00ff88':'#c0392b', stroke: "#555", "stroke-width": "1.5", class: `pin ${state.hoverPin==='bat_+'?'highlight':''}`, id: "bat_+" });
        bat.appendChild(bNeg); bat.appendChild(bPos);
        bat.addEventListener("mousedown", (e) => { if(!e.target.classList.contains('pin')) startDrag(e, "bat"); });
        layer1.appendChild(bat);

        // --- LAYER 2: Components ---
        state.components.forEach(comp => {
            const rp = comp.snap ? comp.snap.snapPos : comp.pos;
            const g = s("g", { transform: `translate(${rp.x},${rp.y})`, style: "cursor: grab" });
            const isA = state.active[comp.id];

            if (comp.type === "led") {
                const head = s("path", { d: "M5 25 Q 5 8, 17 8 Q 29 8, 29 25 L 29 30 L 5 30 Z", fill: isA ? comp.colorLit : comp.color, opacity: "0.9" });
                if (isA) head.setAttribute("filter", comp.id === "led1" ? "url(#glowR)" : "url(#glowG)");
                g.appendChild(head);
                g.appendChild(s("rect", { x: "5", y: "30", width: "24", height: "4", fill: isA ? comp.colorLit : comp.color }));
                g.appendChild(s("line", { x1: "8", y1: "34", x2: "8", y2: "70", stroke: "#ccc", "stroke-width": "2" }));
                g.appendChild(s("line", { x1: "26", y1: "34", x2: "26", y2: "70", stroke: "#ccc", "stroke-width": "2" }));
                comp.leads.forEach(l => {
                    g.appendChild(s("circle", { cx: l.lx, cy: l.ly, r: PIN_R, fill: "#ccc", class: `pin ${state.hoverPin===l.id?'highlight':''}` }));
                });
            } else if (comp.type === "motor") {
                g.appendChild(s("rect", { x: "4", y: "15", width: "38", height: "40", rx: "4", fill: "#333", stroke: "#444", "stroke-width": "1" }));
                g.appendChild(s("circle", { cx: "23", cy: "35", r: "20", fill: "#2a2a2a", stroke: "#555", "stroke-width": "1.5" }));
                g.appendChild(s("circle", { cx: "23", cy: "35", r: "5", fill: "#666" }));
                const rotor = s("g", { style: isA ? "transform-origin: 23px 35px; animation: spin 0.3s linear infinite;" : "" });
                rotor.appendChild(s("rect", { x: "5", y: "33", width: "36", height: "4", rx: "2", fill: isA ? "#00e5ff" : "#555" }));
                g.appendChild(rotor);
                g.appendChild(s("line", { x1: "14", y1: "55", x2: "14", y2: "75", stroke: "#aaa", "stroke-width": "2" }));
                g.appendChild(s("line", { x1: "32", y1: "55", x2: "32", y2: "75", stroke: "#aaa", "stroke-width": "2" }));
                comp.leads.forEach(l => {
                    g.appendChild(s("circle", { cx: l.lx, cy: l.ly, r: PIN_R, fill: "#ccc", class: `pin ${state.hoverPin===l.id?'highlight':''}` }));
                });
            } else if (comp.type === "button") {
                g.appendChild(s("rect", { width: "34", height: "24", rx: "2", fill: "#1a1a1a", stroke: "#333", "stroke-width": "1.5" }));
                g.appendChild(s("circle", { cx: "17", cy: "12", r: "10", fill: "#111" })); 
                const cap = s("circle", { cx: "17", cy: "12", r: comp.pressed ? "7" : "8", fill: "#e74c3c", class: "btn-cap", style: "cursor: pointer; transition: r 0.1s;" });
                cap.addEventListener("mousedown", (e) => { e.stopPropagation(); comp.pressed = true; render(); });
                g.appendChild(cap);
                g.appendChild(s("line", { x1: "8", y1: "24", x2: "8", y2: "60", stroke: "#ccc", "stroke-width": "2" }));
                g.appendChild(s("line", { x1: "26", y1: "24", x2: "26", y2: "60", stroke: "#ccc", "stroke-width": "2" }));
                comp.leads.forEach(l => {
                    g.appendChild(s("circle", { cx: l.lx, cy: l.ly, r: PIN_R, fill: "#ccc", class: `pin ${state.hoverPin===l.id?'highlight':''}` }));
                });
            }
            g.addEventListener("mousedown", (e) => { if(!e.target.classList.contains('pin') && !e.target.classList.contains('btn-cap')) startDrag(e, "comp", comp.id); });
            layer1.appendChild(g);
        });

        // --- LAYER 3: Wires ---
        state.wires.forEach(w => {
            const p1 = pinToSVG(w.from), p2 = pinToSVG(w.to); if (!p1 || !p2) return;
            const path = s("path", { d: `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`, stroke: w.color, "stroke-width": "4", "stroke-linecap": "round", style: "cursor: pointer; opacity: 0.8;" });
            path.addEventListener("click", () => { state.wires = state.wires.filter(x => x.id !== w.id); render(); });
            layer2.appendChild(path);
        });
        if (state.activePin && state.mousePos) {
            const p1 = pinToSVG(state.activePin); if (p1) {
                const target = state.hoverPin ? pinToSVG(state.hoverPin) : state.mousePos;
                layer2.appendChild(s("line", { x1: p1.x, y1: p1.y, x2: target.x, y2: target.y, stroke: "#00ff88", "stroke-width": "2", "stroke-dasharray": "5,5" }));
            }
        }
    }

    function onScreenClick(e) {
        if (!svg || !svg.getScreenCTM()) return;
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const near = findNearestPin(loc.x, loc.y);
        
        if (near) {
            if (!state.activePin) { state.activePin = near.id; }
            else {
                if (state.activePin !== near.id) state.wires.push({ id: state.nextWireId++, from: state.activePin, to: near.id, color: nextColor() });
                state.activePin = null;
            }
            render();
        } else {
            if (state.activePin) { state.activePin = null; render(); }
        }
    }

    function startDrag(e, type, id) {
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        let pos; if(type==='bb') pos = state.bbPos; else if(type==='bat') pos = state.batPos; else pos = state.components.find(c=>c.id===id).pos;
        state.dragTarget = { type, id, offset: { x: loc.x - pos.x, y: loc.y - pos.y } };
        state.dragging = true;
    }

    function setupEvents() {
        svg.addEventListener("click", onScreenClick);
        svg.addEventListener("wheel", (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.2, Math.min(3, state.zoom * delta));
            state.zoom = newZoom;
            updateViewBox();
            render();
        }, { passive: false });

        window.addEventListener("mousemove", (e) => {
            if (!svg || !svg.getScreenCTM()) return;
            const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
            const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
            state.mousePos = { x: loc.x, y: loc.y };
            
            const near = findNearestPin(loc.x, loc.y);
            if (near) {
                if (state.hoverPin !== near.id) { state.hoverPin = near.id; render(); }
            } else {
                if (state.hoverPin) { state.hoverPin = null; render(); }
            }

            if (state.dragging && state.dragTarget) {
                const nx = loc.x - state.dragTarget.offset.x, ny = loc.y - state.dragTarget.offset.y;
                if(state.dragTarget.type === 'bb') {
                    const dx = nx - state.bbPos.x;
                    const dy = ny - state.bbPos.y;
                    state.bbPos = { x: nx, y: ny };
                    state.components.forEach(c => {
                        if (c.snap) { c.pos.x += dx; c.pos.y += dy; }
                    });
                } else if(state.dragTarget.type === 'bat') {
                    state.batPos = { x: nx, y: ny };
                } else {
                    const c = state.components.find(x => x.id === state.dragTarget.id);
                    if(c) c.pos = { x: nx, y: ny };
                }
                render();
            } else if (state.activePin) render();
        });
        window.addEventListener("mouseup", () => { state.dragging = false; state.dragTarget = null; if (state.components.some(c => c.pressed)) { state.components.forEach(c => c.pressed = false); render(); } });
    }

    return { init, reset: resetSimulator };
})();

window.CircuitSimulator = CircuitSimulator;
