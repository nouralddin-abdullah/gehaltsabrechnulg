import fs from 'node:fs';

const TARGETS = [
  'tests/calc.mjs',
  'tests/calc.test.mjs',
  'tests/lohnsteuer.mjs',
  'tests/lohnsteuer.test.mjs',
  'tests/pap.mjs',
  'tests/pap.test.mjs',
  'tests/sv.mjs',
  'tests/sv.test.mjs',
  'scripts/embed-pap-in-html.mjs',
  'scripts/inline-pap.mjs',
  'scripts/verify-against-bmf.mjs',
];

function stripJs(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let prev = '';
  while (i < n) {
    const c = src[i];
    const nx = src[i + 1];

    if (c === '/' && nx === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && nx === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      out += c; i++;
      while (i < n) {
        const ch = src[i];
        out += ch;
        if (ch === '\\') { i++; if (i < n) { out += src[i]; i++; } continue; }
        i++;
        if (ch === q) break;
      }
      prev = q;
      continue;
    }
    if (c === '`') {
      out += c; i++;
      let depth = 0;
      while (i < n) {
        const ch = src[i];
        if (depth === 0 && ch === '`') { out += ch; i++; break; }
        if (ch === '\\') { out += ch; i++; if (i < n) { out += src[i]; i++; } continue; }
        if (ch === '$' && src[i + 1] === '{') { depth++; out += '${'; i += 2; continue; }
        if (depth > 0 && ch === '}') { depth--; out += ch; i++; continue; }
        out += ch; i++;
      }
      prev = '`';
      continue;
    }
    if (c === '/' && canStartRegex(prev)) {
      out += c; i++;
      let inClass = false;
      while (i < n) {
        const ch = src[i];
        out += ch;
        if (ch === '\\') { i++; if (i < n) { out += src[i]; i++; } continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        i++;
        if (ch === '/' && !inClass) break;
      }
      while (i < n && /[a-z]/i.test(src[i])) { out += src[i]; i++; }
      prev = '/';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

function canStartRegex(prev) {
  if (!prev) return true;
  return /[=({[,;:!&|?+\-*%<>^~/]/.test(prev) || prev === 'return' || prev === 'typeof';
}

function stripCss(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '');
}

function processHtml(src) {
  const parts = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const scriptOpen = src.indexOf('<script', i);
    const styleOpen = src.indexOf('<style', i);
    let next = -1;
    let kind = null;
    if (scriptOpen >= 0 && (styleOpen < 0 || scriptOpen < styleOpen)) {
      next = scriptOpen; kind = 'script';
    } else if (styleOpen >= 0) {
      next = styleOpen; kind = 'style';
    }
    if (next < 0) {
      parts.push(stripHtmlComments(src.slice(i)));
      break;
    }
    parts.push(stripHtmlComments(src.slice(i, next)));
    const tagEnd = src.indexOf('>', next);
    const openTag = src.slice(next, tagEnd + 1);
    parts.push(openTag);
    const closeTag = kind === 'script' ? '</script>' : '</style>';
    const close = src.indexOf(closeTag, tagEnd + 1);
    if (close < 0) {
      parts.push(src.slice(tagEnd + 1));
      break;
    }
    const body = src.slice(tagEnd + 1, close);
    parts.push(kind === 'script' ? stripJs(body) : stripCss(body));
    parts.push(closeTag);
    i = close + closeTag.length;
  }
  return parts.join('');
}

function collapseBlankLines(s) {
  return s.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : TARGETS.concat(['gehaltsabrechnung.html']);
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const processed = f.endsWith('.html') ? processHtml(src) : stripJs(src);
  fs.writeFileSync(f, collapseBlankLines(processed));
  console.log(`stripped: ${f}  (${src.length} -> ${processed.length} bytes)`);
}
