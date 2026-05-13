// Generic interpreter for the BMF Lohnsteuer-Programmablaufplan (PAP) XML.
//
// The BMF publishes a yearly PAP as XML. This module parses that XML and
// executes it against a set of INPUT values (Brutto, Steuerklasse, etc.) to
// produce the official outputs (LSTLZZ = Lohnsteuer in cents, SOLZLZZ = Soli,
// BK = Bemessungsgrundlage Kirchensteuer, …).
//
// Why interpret instead of hand-translate: the PAP changes every January, and
// hand-translating the ~50 methods is error-prone. Interpreting the XML means
// the engine auto-updates when we drop in the new year's file.
//
// Numeric model: we use Number, not BigDecimal. The PAP uses BigDecimal so its
// rounding boundaries are deterministic. We mimic this by faithfully applying
// setScale() and divide(scale, mode) at every rounding boundary the PAP
// specifies. Sub-cent errors can creep in, but the published Lohnsteuer values
// are integer EUR for the year (LSTLZZ is in cents), so rounding at boundaries
// keeps us within ±1 cent of BMF.
//
// Reference XML format: https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml

const ROUND_DOWN = 'DOWN', ROUND_UP = 'UP', ROUND_HALF_UP = 'HALF_UP', ROUND_UNNECESSARY = 'UN';

function _scale(n, scale, mode) {
  const factor = Math.pow(10, scale);
  const scaled = n * factor;
  let result;
  if (mode === ROUND_DOWN) result = scaled >= 0 ? Math.floor(scaled) : Math.ceil(scaled);
  else if (mode === ROUND_UP) result = scaled >= 0 ? Math.ceil(scaled) : Math.floor(scaled);
  else if (mode === ROUND_HALF_UP) result = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  else result = scaled; // ROUND_UNNECESSARY etc.
  return result / factor;
}

const _api = {
  _add: (a, b) => a + b,
  _sub: (a, b) => a - b,
  _mul: (a, b) => a * b,
  _div: (a, b, scale, mode) => (scale != null && mode != null) ? _scale(a / b, scale, mode) : a / b,
  _round: (a, scale, mode) => _scale(a, scale, mode),
  _max: (a, b) => Math.max(a, b),
  _min: (a, b) => Math.min(a, b),
  _cmp: (a, b) => a > b ? 1 : a < b ? -1 : 0,
  _trunc: a => Math.trunc(a),
  ROUND_DOWN, ROUND_UP, ROUND_HALF_UP, ROUND_UNNECESSARY,
};

// Convert a Java-BigDecimal expression to a JS expression using a
// recursive-descent parser.
//
// Grammar (informal):
//   expr     := orExpr
//   orExpr   := andExpr ( '||' andExpr )*
//   andExpr  := cmpExpr ( '&&' cmpExpr )*
//   cmpExpr  := addExpr ( ('=='|'!='|'<='|'>='|'<'|'>') addExpr )?
//   addExpr  := mulExpr ( ('+'|'-') mulExpr )*
//   mulExpr  := unary  ( ('*'|'/') unary )*
//   unary    := ('-' | '!')? postfix
//   postfix  := primary ( '.' IDENT '(' args? ')' | '[' expr ']' )*
//   primary  := NUMBER | IDENT | '(' expr ')' | IDENT '(' args? ')'
//   args     := expr (',' expr)*
const METHODS = {
  add: (r, a) => `(${r} + ${a[0]})`,
  subtract: (r, a) => `(${r} - ${a[0]})`,
  multiply: (r, a) => `(${r} * ${a[0]})`,
  divide: (r, a) => a.length === 1 ? `(${r} / ${a[0]})` : `_div(${r}, ${a.join(', ')})`,
  max: (r, a) => `_max(${r}, ${a[0]})`,
  min: (r, a) => `_min(${r}, ${a[0]})`,
  compareTo: (r, a) => `_cmp(${r}, ${a[0]})`,
  longValue: (r) => `_trunc(${r})`,
  setScale: (r, a) => `_round(${r}, ${a.join(', ')})`,
};

export function convertExpr(src) {
  const p = new Parser(src);
  return p.parseExpr();
}

class Parser {
  constructor(src) {
    this.src = src;
    this.i = 0;
  }
  ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }
  peek(s) {
    this.ws();
    return this.src.startsWith(s, this.i);
  }
  consume(s) {
    if (!this.peek(s)) throw new Error(`Expected '${s}' at ${this.i} in: ${this.src}`);
    this.i += s.length;
  }
  tryConsume(s) {
    if (this.peek(s)) { this.i += s.length; return true; }
    return false;
  }
  // Tokens
  matchIdent() {
    this.ws();
    const m = /^[A-Za-z_]\w*/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }
  matchNumber() {
    this.ws();
    const m = /^-?\d+(\.\d+)?/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }
  // Top-level entry
  parseExpr() {
    const r = this.parseOr();
    this.ws();
    if (this.i < this.src.length) {
      // Allow trailing junk: caller may pass an assignment 'X = expr'; if we
      // see an '=' at top, treat it as assignment.
      // Otherwise it's a parse error.
      throw new Error('Trailing content at ' + this.i + ': ' + this.src.slice(this.i));
    }
    return r;
  }
  parseOr() {
    let l = this.parseAnd();
    while (this.tryConsume('||')) {
      const r = this.parseAnd();
      l = `(${l} || ${r})`;
    }
    return l;
  }
  parseAnd() {
    let l = this.parseCmp();
    while (this.tryConsume('&&')) {
      const r = this.parseCmp();
      l = `(${l} && ${r})`;
    }
    return l;
  }
  parseCmp() {
    let l = this.parseAdd();
    for (const op of ['==', '!=', '<=', '>=', '<', '>']) {
      if (this.tryConsume(op)) {
        const r = this.parseAdd();
        return `(${l} ${op} ${r})`;
      }
    }
    return l;
  }
  parseAdd() {
    let l = this.parseMul();
    while (true) {
      this.ws();
      if (this.tryConsume('+')) {
        const r = this.parseMul();
        l = `(${l} + ${r})`;
      } else if (this.peek('-') && !this.peek('->')) {
        this.i++; // consume single '-'
        const r = this.parseMul();
        l = `(${l} - ${r})`;
      } else break;
    }
    return l;
  }
  parseMul() {
    let l = this.parseUnary();
    while (this.tryConsume('*') || this.tryConsume('/')) {
      // We don't know which op we ate; backtrack 1 char to read it.
      const op = this.src[this.i - 1];
      const r = this.parseUnary();
      l = `(${l} ${op} ${r})`;
    }
    return l;
  }
  parseUnary() {
    this.ws();
    if (this.tryConsume('!')) return `!(${this.parsePostfix()})`;
    if (this.peek('-') && !/\d/.test(this.src[this.i + 1] || '')) {
      // unary minus only if not part of a number literal
      this.i++;
      return `(-${this.parsePostfix()})`;
    }
    return this.parsePostfix();
  }
  parsePostfix() {
    let r = this.parsePrimary();
    while (true) {
      this.ws();
      if (this.peek('.')) {
        const save = this.i;
        this.i++;
        const name = this.matchIdent();
        if (!name) { this.i = save; break; }
        this.ws();
        if (!this.peek('(')) {
          // Not a method call — could be a property access (BigDecimal.ROUND_DOWN handled below).
          // For now, treat 'a.b' as 'a.b' literally if not followed by '('.
          r = `${r}.${name}`;
          continue;
        }
        this.consume('(');
        const args = [];
        this.ws();
        if (!this.peek(')')) {
          args.push(this.parseOr());
          while (this.tryConsume(',')) args.push(this.parseOr());
        }
        this.consume(')');
        if (METHODS[name]) {
          r = METHODS[name](r, args);
        } else {
          // Unknown chain method — preserve literally (shouldn't happen for valid PAP).
          r = `${r}.${name}(${args.join(', ')})`;
        }
      } else if (this.peek('[')) {
        this.consume('[');
        const idx = this.parseOr();
        this.consume(']');
        r = `${r}[${idx}]`;
      } else break;
    }
    return r;
  }
  parsePrimary() {
    this.ws();
    if (this.peek('(')) {
      this.consume('(');
      const e = this.parseOr();
      this.consume(')');
      return `(${e})`;
    }
    const num = this.matchNumber();
    if (num != null) return num;
    const id = this.matchIdent();
    if (!id) throw new Error('Expected primary at ' + this.i + ' in: ' + this.src);
    // BigDecimal special forms
    if (id === 'BigDecimal') {
      this.consume('.');
      const member = this.matchIdent();
      if (member === 'ZERO') return '0';
      if (member === 'ONE') return '1';
      if (member === 'ROUND_DOWN') return "ROUND_DOWN";
      if (member === 'ROUND_UP') return "ROUND_UP";
      if (member === 'ROUND_HALF_UP') return "ROUND_HALF_UP";
      if (member === 'ROUND_UNNECESSARY') return "ROUND_UNNECESSARY";
      if (member === 'valueOf') {
        this.consume('(');
        const v = this.parseOr();
        this.consume(')');
        return `(${v})`;
      }
      throw new Error('Unknown BigDecimal member: ' + member);
    }
    // Function call: IDENT '(' args ')'
    this.ws();
    if (this.peek('(')) {
      this.consume('(');
      const args = [];
      this.ws();
      if (!this.peek(')')) {
        args.push(this.parseOr());
        while (this.tryConsume(',')) args.push(this.parseOr());
      }
      this.consume(')');
      return `${id}(${args.join(', ')})`;
    }
    return id;
  }
}

// Minimal XML walker. The PAP XML is regular; we parse it on the fly using
// regex-driven tokenization. Each method body is a list of statements.
//
// Statement types:
//   { type:'eval',    expr }      // <EVAL exec="..."/>
//   { type:'execute', method }    // <EXECUTE method="..."/>
//   { type:'if',      cond, then, else } // <IF><THEN>...<ELSE>...</IF>
//
// Whitespace and comments are stripped during parse.

function parseStatements(body) {
  const stmts = [];
  let i = 0;
  while (i < body.length) {
    // Skip whitespace and comments
    while (i < body.length) {
      const wsMatch = /^\s+/.exec(body.slice(i));
      if (wsMatch) { i += wsMatch[0].length; continue; }
      if (body.startsWith('<!--', i)) {
        const end = body.indexOf('-->', i);
        if (end < 0) throw new Error('Unterminated comment');
        i = end + 3;
        continue;
      }
      break;
    }
    if (i >= body.length) break;

    // <EVAL exec="..."/>
    let m = /^<EVAL\s+exec\s*=\s*"((?:[^"\\]|\\.)*)"\s*\/>/.exec(body.slice(i));
    if (m) { stmts.push({ type: 'eval', expr: m[1] }); i += m[0].length; continue; }

    // <EXECUTE method="..."/>
    m = /^<EXECUTE\s+method\s*=\s*"(\w+)"\s*\/>/.exec(body.slice(i));
    if (m) { stmts.push({ type: 'execute', method: m[1] }); i += m[0].length; continue; }

    // <IF expr="...">...</IF>
    m = /^<IF\s+expr\s*=\s*"((?:[^"\\]|\\.)*)"\s*>/.exec(body.slice(i));
    if (m) {
      const cond = m[1];
      i += m[0].length;
      const ifEnd = findMatchingClose(body, i, 'IF');
      const inner = body.slice(i, ifEnd);
      i = ifEnd + '</IF>'.length;
      const { then: thenStmts, else: elseStmts } = parseThenElse(inner);
      stmts.push({ type: 'if', cond, then: thenStmts, else: elseStmts });
      continue;
    }

    // </THEN> </ELSE> are handled in parseThenElse, so we should never see them here.
    throw new Error('Unexpected at offset ' + i + ': ' + body.slice(i, i + 60));
  }
  return stmts;
}

function findMatchingClose(s, start, tag) {
  // Find matching </tag> handling nested <tag> opens.
  const openRe = new RegExp('<' + tag + '\\b', 'g');
  const closeRe = new RegExp('</' + tag + '>', 'g');
  let depth = 1;
  let pos = start;
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const o = openRe.exec(s);
    const c = closeRe.exec(s);
    if (!c) throw new Error('Unmatched <' + tag + '>');
    if (o && o.index < c.index) { depth++; pos = o.index + tag.length + 1; }
    else { depth--; if (depth === 0) return c.index; pos = c.index + tag.length + 3; }
  }
  throw new Error('Unreachable');
}

function parseThenElse(inner) {
  // Inner = whitespace + <THEN>...</THEN> + (whitespace + <ELSE>...</ELSE>)?
  let i = 0;
  while (/\s/.test(inner[i])) i++;
  if (!inner.startsWith('<THEN>', i)) throw new Error('Expected <THEN>');
  i += '<THEN>'.length;
  const thenEnd = findMatchingClose(inner, i, 'THEN');
  const thenBody = inner.slice(i, thenEnd);
  i = thenEnd + '</THEN>'.length;
  while (i < inner.length && /\s/.test(inner[i])) i++;
  let elseBody = '';
  if (inner.startsWith('<ELSE>', i)) {
    i += '<ELSE>'.length;
    const elseEnd = findMatchingClose(inner, i, 'ELSE');
    elseBody = inner.slice(i, elseEnd);
  }
  return { then: parseStatements(thenBody), else: parseStatements(elseBody) };
}

// Extract methods from the XML source.
function parseMethods(xml) {
  const methods = {};
  // <MAIN>…</MAIN> is the root; treat it like a method named MAIN.
  const mainMatch = /<MAIN>([\s\S]*?)<\/MAIN>/.exec(xml);
  if (mainMatch) methods.MAIN = parseStatements(mainMatch[1]);
  const re = /<METHOD\s+name="(\w+)"\s*>([\s\S]*?)<\/METHOD>/g;
  let m;
  while ((m = re.exec(xml))) methods[m[1]] = parseStatements(m[2]);
  return methods;
}

// Extract initial state (defaults for INPUT / INTERNAL).
// Defaults can be: BigDecimal.ZERO, BigDecimal.valueOf(N), explicit numbers,
// or `new BigDecimal(N)`. Arrays (TABx) are read from <CONSTANT>.
function parseInitialState(xml) {
  const state = {};
  // Tolerant patterns — handle attribute order and typos like "defaul=" in some PAP files.
  const inputRe = /<INPUT\s+name="(\w+)"[^/]*?(?:default="([^"]+)")?[^/]*?\/>/g;
  const internalRe = /<INTERNAL\s+name="(\w+)"[^/]*?(?:default="([^"]+)")?[^/]*?\/>/g;
  const outputRe = /<OUTPUT\s+name="(\w+)"[^/]*?(?:default="([^"]+)")?[^/]*?\/>/g;
  for (const re of [inputRe, internalRe, outputRe]) {
    let m;
    while ((m = re.exec(xml))) {
      const name = m[1];
      const dflt = m[2];
      if (!dflt || dflt === 'BigDecimal.ZERO') state[name] = 0;
      else if (dflt === 'BigDecimal.ONE') state[name] = 1;
      else if (/^BigDecimal\.valueOf\((-?[\d.]+)\)$/.test(dflt)) state[name] = +RegExp.$1;
      else if (/^new BigDecimal\("?(-?[\d.]+)"?\)$/.test(dflt)) state[name] = +RegExp.$1;
      else if (/^-?[\d.]+$/.test(dflt)) state[name] = +dflt;
      else state[name] = 0; // unknown default form; will be set during execution
    }
  }
  // Constants — only the numeric ones (ZAHL*) and arrays
  const constRe = /<CONSTANT\s+name="(\w+)"\s+type="(BigDecimal(?:\[\])?)"\s+value="([^"]+)"\s*\/>/g;
  let c;
  while ((c = constRe.exec(xml))) {
    const name = c[1], type = c[2], value = c[3];
    if (type === 'BigDecimal[]') {
      // value like "{BigDecimal.ZERO, BigDecimal.valueOf(0.4), …}"
      const items = value.slice(1, -1).split(',').map(s => {
        const t = s.trim();
        if (t === 'BigDecimal.ZERO') return 0;
        if (t === 'BigDecimal.ONE') return 1;
        const m = /BigDecimal\.valueOf\(\s*(-?[\d.]+)\s*\)/.exec(t);
        if (m) return +m[1];
        return Number(t);
      });
      state[name] = items;
    } else if (value === 'BigDecimal.ZERO') state[name] = 0;
    else if (value === 'BigDecimal.ONE') state[name] = 1;
    else {
      const m = /BigDecimal\.valueOf\(\s*(-?[\d.]+)\s*\)/.exec(value);
      state[name] = m ? +m[1] : Number(value);
    }
  }
  return state;
}

// Compile a method body's statements into a JS function source.
function compileStatements(stmts) {
  return stmts.map(compileStatement).join('\n');
}

function compileStatement(s) {
  if (s.type === 'eval') {
    // EVAL exec is of the form "LHS = RHS". Split on the first '=' that is NOT
    // part of '==', '<=', '>=', '!='.
    const m = /^([^=<>!]+?)\s*=\s*(?!=)(.+)$/.exec(s.expr);
    if (!m) {
      const js = convertExpr(s.expr);
      return scopeVars(js) + ';';
    }
    const lhs = m[1].trim();
    const rhs = m[2].trim();
    const lhsJS = convertExpr(lhs);
    const rhsJS = convertExpr(rhs);
    return scopeVars(lhsJS) + ' = ' + scopeVars(rhsJS) + ';';
  }
  if (s.type === 'execute') {
    return `_M.${s.method}.call(this);`;
  }
  if (s.type === 'if') {
    const cond = scopeVars(convertExpr(s.cond));
    return `if (${cond}) {\n${compileStatements(s.then)}\n}` +
      (s.else.length ? ` else {\n${compileStatements(s.else)}\n}` : '');
  }
  throw new Error('Unknown stmt: ' + s.type);
}

// Make every variable reference go through `this.`. We use a name list so we
// only prefix actual PAP variables, not local helpers like `_add`, `Math`, etc.
let _varNames = null;
function setVarNames(names) { _varNames = new Set(names); }
function scopeVars(src) {
  return src.replace(/\b([A-Za-z_]\w*)\b/g, (m, name) => {
    if (_varNames && _varNames.has(name)) return `this.${name}`;
    return m;
  });
}

export function compilePap(xml) {
  // Strip comments globally — they appear inside method bodies and confuse the
  // structural regex that expects <THEN>/<ELSE> right after <IF>.
  xml = xml.replace(/<!--[\s\S]*?-->/g, '');
  // Decode XML entities that appear in expr/exec attributes (mostly < and >).
  xml = xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const methods = parseMethods(xml);
  const state = parseInitialState(xml);
  setVarNames(Object.keys(state));
  const compiledMethods = {};
  const helperNames = Object.keys(_api);
  for (const [name, stmts] of Object.entries(methods)) {
    const body = compileStatements(stmts);
    try {
      compiledMethods[name] = new Function('_M', ...helperNames, body);
    } catch (e) {
      throw new Error(`Failed compiling ${name}: ${e.message}\n--- body ---\n${body}\n--- end ---`);
    }
  }
  setVarNames(null);
  return {
    initialState: state,
    methods: compiledMethods,
    run(inputs) {
      const ctx = { ...this.initialState, ...inputs };
      const helpers = helperNames.map(k => _api[k]);
      // Wrap each method so that `this` is bound to ctx and helpers are passed
      // as positional args along with the method map.
      const wrappedMethods = {};
      for (const k of Object.keys(this.methods)) {
        wrappedMethods[k] = { call: (t) => this.methods[k].call(t, wrappedMethods, ...helpers) };
      }
      this.methods.MAIN.call(ctx, wrappedMethods, ...helpers);
      return ctx;
    },
  };
}
