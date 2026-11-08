// 共享安全表达式求值引擎（无 eval）
// 暴露 window.TB.calcEval(expr, {deg}) -> number
// 支持：数字(整数/小数/科学计数) + - * / % ^ 括号 逗号(多参)
//       函数：sqrt cbrt abs sign sin cos tan asin acos atan sinh cosh tanh
//             log ln log2 exp floor ceil round trunc min max pow fact 10x
//       常量：pi e
(function () {
  'use strict';

  function makeFuncs(deg) {
    const d2r = Math.PI / 180;
    const tri = (f) => deg ? (x) => f(x * d2r) : f;
    const atri = (f) => deg ? (x) => f(x) / d2r : f;
    return {
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
      sin: tri(Math.sin), cos: tri(Math.cos), tan: tri(Math.tan),
      asin: atri(Math.asin), acos: atri(Math.acos), atan: atri(Math.atan),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      log: Math.log10, ln: Math.log, log2: Math.log2,
      exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
      min: Math.min, max: Math.max, pow: Math.pow,
      '10x': (x) => Math.pow(10, x),
      fact: (n) => {
        if (!Number.isInteger(n)) throw new Error('阶乘仅支持整数');
        if (n < 0) throw new Error('负数无阶乘');
        if (n > 170) throw new Error('数值过大');
        let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
      }
    };
  }

  function tokenize(s) {
    const toks = [];
    let i = 0;
    const isDig = (c) => c >= '0' && c <= '9' || c === '.';
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (isDig(ch)) {
        let j = i;
        while (j < s.length && isDig(s[j])) j++;
        if (j < s.length && (s[j] === 'e' || s[j] === 'E')) {
          let k = j + 1;
          if (k < s.length && (s[k] === '+' || s[k] === '-')) k++;
          let m = k;
          while (m < s.length && s[m] >= '0' && s[m] <= '9') m++;
          if (m > k) j = m;
        }
        const num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1) throw new Error('数字格式错误: ' + num);
        toks.push({ t: 'num', v: parseFloat(num) });
        i = j; continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let j = i;
        while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
        const name = s.slice(i, j);
        if (name === 'pi' || name === 'e') toks.push({ t: 'num', v: name === 'pi' ? Math.PI : Math.E });
        else toks.push({ t: 'id', v: name });
        i = j; continue;
      }
      if ('+-*/%^(),'.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
      throw new Error('非法字符: ' + ch);
    }
    return toks;
  }

  function parse(toks, FUNCS) {
    let pos = 0;
    const peek = () => toks[pos];
    const eat = (v) => { if (toks[pos] && toks[pos].v === v) { pos++; return true; } return false; };
    function expr() {
      let v = term();
      while (peek() && (peek().v === '+' || peek().v === '-')) {
        const op = toks[pos++].v; const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = factor();
      while (peek() && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
        const op = toks[pos++].v; const r = factor();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    }
    function factor() {
      let v;
      if (peek() && (peek().v === '-' || peek().v === '+')) {
        const op = toks[pos++].v; v = factor(); if (op === '-') v = -v;
      } else v = primary();
      if (peek() && peek().v === '^') { pos++; v = Math.pow(v, factor()); }
      return v;
    }
    function primary() {
      const tk = toks[pos++];
      if (!tk) throw new Error('表达式不完整');
      if (tk.t === 'num') return tk.v;
      if (tk.v === '(') {
        const v = expr();
        if (!eat(')')) throw new Error('缺少右括号 )');
        return v;
      }
      if (tk.t === 'id') {
        if (peek() && peek().v === '(') {
          pos++;
          const args = [];
          if (!(peek() && peek().v === ')')) {
            args.push(expr());
            while (eat(',')) args.push(expr());
          }
          if (!eat(')')) throw new Error('函数缺少右括号 )');
          const f = FUNCS[tk.v.toLowerCase()];
          if (!f) throw new Error('未知函数: ' + tk.v);
          return f.apply(null, args);
        }
        throw new Error('未知标识符: ' + tk.v);
      }
      throw new Error('语法错误');
    }
    const r = expr();
    if (pos < toks.length) throw new Error('多余字符: ' + toks[pos].v);
    return r;
  }

  function fmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) throw new Error('结果非有限数');
    if (Number.isInteger(n)) return String(n);
    let s = n.toPrecision(12);
    if (s.indexOf('e') === -1 && s.indexOf('.') !== -1) {
      s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
  }

  TB.calcEval = function (expr, opts) {
    opts = opts || {};
    const FUNCS = makeFuncs(!!opts.deg);
    const r = parse(tokenize(String(expr)), FUNCS);
    return fmt(r);
  };
})();
