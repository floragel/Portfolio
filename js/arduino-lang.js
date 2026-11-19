/**
 * Tiny Arduino-language interpreter for the circuit simulator.
 * Supports: void setup() / void loop(), int/long/float/bool/byte declarations, assignments (=, +=, -=, *=, /=, ++, --),
 * for / while / if / else, pinMode, digitalWrite, analogWrite, delay, millis, random, map, constrain, min, max, abs.
 * Runs as a generator so delay() never blocks the page.
 */
const ArduinoLang = (function () {
  'use strict';

  class LangError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

  // ---------- tokenizer ----------
  function tokenize(src) {
    const toks = []; let i = 0, line = 1;
    const push = (type, value) => toks.push({ type, value, line });
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; } // #define / #include ignored
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        let j = i; while (j < src.length && /[0-9.xXa-fA-F]/.test(src[j])) j++;
        const raw = src.slice(i, j).replace(/[uUlL]+$/, ''); push('num', Number(raw)); i = j;
        while (/[uUlLfF]/.test(src[i] || '')) i++;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++; push('id', src.slice(i, j)); i = j; continue; }
      const two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%='].includes(two)) { push('op', two); i += 2; continue; }
      if ('+-*/%<>=!(){};,?:'.includes(c)) { push('op', c); i++; continue; }
      throw new LangError(`Caractère inattendu « ${c} » / Unexpected character "${c}"`, line);
    }
    push('eof', null);
    return toks;
  }

  // ---------- parser ----------
  const TYPES = new Set(['int', 'long', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'unsigned', 'const', 'short', 'uint8_t', 'uint16_t', 'int16_t', 'uint32_t']);

  function parse(src) {
    const t = tokenize(src); let p = 0;
    const peek = (o = 0) => t[p + o];
    const is = (v) => peek().value === v && peek().type !== 'num';
    const expect = (v) => { if (!is(v)) throw new LangError(`« ${v} » attendu / expected "${v}"`, peek().line); return t[p++]; };
    const funcs = {}; const globals = [];

    function parseType() { let any = false; while (peek().type === 'id' && TYPES.has(peek().value)) { p++; any = true; } return any; }

    function program() {
      while (peek().type !== 'eof') {
        const start = p;
        if (is('void') || (peek().type === 'id' && TYPES.has(peek().value))) {
          if (is('void')) p++; else parseType();
          const name = t[p++];
          if (is('(')) { expect('('); while (!is(')')) p++; expect(')'); funcs[name.value] = block(); continue; }
          p = start; globals.push(statement()); continue;
        }
        globals.push(statement());
      }
      return { funcs, globals };
    }
    function block() { expect('{'); const body = []; while (!is('}')) { if (peek().type === 'eof') throw new LangError('« } » manquant / missing "}"', peek().line); body.push(statement()); } expect('}'); return body; }
    function statement() {
      const line = peek().line;
      if (is('{')) return { k: 'block', body: block(), line };
      if (is(';')) { p++; return { k: 'nop', line }; }
      if (is('for')) {
        p++; expect('(');
        const init = is(';') ? null : simple(); expect(';');
        const cond = is(';') ? null : expr(); expect(';');
        const step = is(')') ? null : simple(); expect(')');
        return { k: 'for', init, cond, step, body: statement(), line };
      }
      if (is('while')) { p++; expect('('); const cond = expr(); expect(')'); return { k: 'while', cond, body: statement(), line }; }
      if (is('if')) {
        p++; expect('('); const cond = expr(); expect(')'); const then = statement();
        let els = null; if (is('else')) { p++; els = statement(); }
        return { k: 'if', cond, then, els, line };
      }
      const s = simple(); expect(';'); return s;
    }
    function simple() {
      const line = peek().line;
      if (peek().type === 'id' && TYPES.has(peek().value)) {
        parseType(); const decls = [];
        do { const name = t[p++]; if (name.type !== 'id') throw new LangError('Nom de variable attendu / variable name expected', line); let init = null; if (is('=')) { p++; init = expr(); } decls.push({ name: name.value, init }); } while (is(',') && ++p);
        return { k: 'decl', decls, line };
      }
      if (peek().type === 'id' && ['=', '+=', '-=', '*=', '/=', '%='].includes(peek(1).value)) {
        const name = t[p++].value; const op = t[p++].value; return { k: 'assign', name, op, value: expr(), line };
      }
      if (peek().type === 'id' && ['++', '--'].includes(peek(1).value)) { const name = t[p++].value; const op = t[p++].value; return { k: 'assign', name, op: op === '++' ? '+=' : '-=', value: { k: 'num', v: 1 }, line }; }
      if (['++', '--'].includes(peek().value) && peek(1).type === 'id') { const op = t[p++].value; const name = t[p++].value; return { k: 'assign', name, op: op === '++' ? '+=' : '-=', value: { k: 'num', v: 1 }, line }; }
      return { k: 'expr', e: expr(), line };
    }
    // precedence climbing
    function expr() { return ternary(); }
    function ternary() { const c = bin(0); if (is('?')) { p++; const a = expr(); expect(':'); const b = expr(); return { k: 'tern', c, a, b }; } return c; }
    const PREC = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];
    function bin(level) {
      if (level >= PREC.length) return unary();
      let left = bin(level + 1);
      while (peek().type === 'op' && PREC[level].includes(peek().value)) { const op = t[p++].value; left = { k: 'bin', op, a: left, b: bin(level + 1) }; }
      return left;
    }
    function unary() {
      if (is('!')) { p++; return { k: 'not', a: unary() }; }
      if (is('-')) { p++; return { k: 'neg', a: unary() }; }
      if (is('(')) {
        // cast like (int) x
        if (peek(1).type === 'id' && TYPES.has(peek(1).value) && peek(2).value === ')') { p += 3; return unary(); }
        p++; const e = expr(); expect(')'); return e;
      }
      const tk = t[p++];
      if (tk.type === 'num') return { k: 'num', v: tk.value };
      if (tk.type === 'id') {
        if (is('(')) { p++; const args = []; while (!is(')')) { args.push(expr()); if (is(',')) p++; } expect(')'); return { k: 'call', name: tk.value, args, line: tk.line }; }
        return { k: 'var', name: tk.value, line: tk.line };
      }
      throw new LangError(`Expression invalide près de « ${tk.value ?? 'fin'} » / Invalid expression near "${tk.value ?? 'end'}"`, tk.line);
    }
    return program();
  }

  // ---------- runtime ----------
  const CONSTS = { HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, true: 1, false: 0, LED_BUILTIN: 13 };

  function createProgram(src, io) {
    const ast = parse(src);
    if (!ast.funcs.loop && !ast.funcs.setup) throw new LangError('Il faut une fonction setup() ou loop() / Need a setup() or loop() function', 1);
    const env = Object.create(null);
    const start = Date.now();
    let budget = 0;

    function lookup(name, line) {
      if (name in env) return env[name];
      if (name in CONSTS) return CONSTS[name];
      throw new LangError(`Variable inconnue « ${name} » / Unknown variable "${name}"`, line);
    }
    function ev(e) {
      switch (e.k) {
        case 'num': return e.v;
        case 'var': return lookup(e.name, e.line);
        case 'neg': return -ev(e.a);
        case 'not': return ev(e.a) ? 0 : 1;
        case 'tern': return ev(e.c) ? ev(e.a) : ev(e.b);
        case 'bin': {
          if (e.op === '&&') return ev(e.a) && ev(e.b) ? 1 : 0;
          if (e.op === '||') return ev(e.a) || ev(e.b) ? 1 : 0;
          const a = ev(e.a), b = ev(e.b);
          switch (e.op) {
            case '+': return a + b; case '-': return a - b; case '*': return a * b;
            case '/': return b === 0 ? 0 : (Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b);
            case '%': return b === 0 ? 0 : a % b;
            case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
            case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
          }
          break;
        }
        case 'call': return callFn(e);
      }
      return 0;
    }
    function pin(n, line) {
      const v = Math.round(n);
      if (!io.pins.includes(v)) throw new LangError(`Broche ${v} non disponible (D${io.pins[0]} à D${io.pins[io.pins.length - 1]}) / Pin ${v} not available`, line);
      return v;
    }
    function callFn(e) {
      const a = e.args.map(ev);
      switch (e.name) {
        case 'pinMode': io.pinMode(pin(a[0], e.line), a[1]); return 0;
        case 'digitalWrite': io.write(pin(a[0], e.line), a[1] ? 255 : 0); return 0;
        case 'analogWrite': io.write(pin(a[0], e.line), Math.max(0, Math.min(255, Math.round(a[1])))); return 0;
        case 'digitalRead': return io.read ? io.read(pin(a[0], e.line)) : 0;
        case 'millis': return Date.now() - start;
        case 'random': return a.length > 1 ? a[0] + Math.floor(Math.random() * (a[1] - a[0])) : Math.floor(Math.random() * a[0]);
        case 'map': return Math.trunc((a[0] - a[1]) * (a[4] - a[3]) / (a[2] - a[1]) + a[3]);
        case 'constrain': return Math.min(a[2], Math.max(a[1], a[0]));
        case 'min': return Math.min(a[0], a[1]);
        case 'max': return Math.max(a[0], a[1]);
        case 'abs': return Math.abs(a[0]);
        case 'delay': case 'delayMicroseconds': return 0; // handled as statements
      }
      if (ast.funcs[e.name]) throw new LangError(`Appelle ${e.name}() comme une instruction / call ${e.name}() as a statement`, e.line);
      throw new LangError(`Fonction inconnue ${e.name}() / Unknown function ${e.name}()`, e.line);
    }

    function* run(stmts) {
      for (const s of stmts) yield* exec(s);
    }
    function* exec(s) {
      if (++budget > 4000) { budget = 0; yield 0; } // keep the page responsive in tight loops
      switch (s.k) {
        case 'nop': return;
        case 'block': yield* run(s.body); return;
        case 'decl': for (const d of s.decls) env[d.name] = d.init ? ev(d.init) : 0; return;
        case 'assign': {
          const v = ev(s.value);
          if (s.op === '=') { env[s.name] = v; return; }
          const cur = lookup(s.name, s.line);
          env[s.name] = s.op === '+=' ? cur + v : s.op === '-=' ? cur - v : s.op === '*=' ? cur * v : s.op === '/=' ? (v ? cur / v : 0) : (v ? cur % v : 0);
          return;
        }
        case 'expr': {
          const e = s.e;
          if (e.k === 'call' && (e.name === 'delay' || e.name === 'delayMicroseconds')) {
            const ms = e.name === 'delay' ? ev(e.args[0] || { k: 'num', v: 0 }) : ev(e.args[0]) / 1000;
            budget = 0; yield Math.max(0, ms); return;
          }
          if (e.k === 'call' && ast.funcs[e.name]) { yield* run(ast.funcs[e.name]); return; }
          ev(e); return;
        }
        case 'if': if (ev(s.cond)) yield* exec(s.then); else if (s.els) yield* exec(s.els); return;
        case 'while': while (ev(s.cond)) yield* exec(s.body); return;
        case 'for': {
          if (s.init) yield* exec(s.init);
          while (s.cond ? ev(s.cond) : true) { yield* exec(s.body); if (s.step) yield* exec(s.step); }
          return;
        }
      }
    }

    function* main() {
      yield* run(ast.globals);
      if (ast.funcs.setup) yield* run(ast.funcs.setup);
      if (!ast.funcs.loop) return;
      for (;;) { yield* run(ast.funcs.loop); yield 1; } // at least 1 ms per loop() pass
    }
    return main();
  }

  return { createProgram, LangError };
})();

window.ArduinoLang = ArduinoLang;
