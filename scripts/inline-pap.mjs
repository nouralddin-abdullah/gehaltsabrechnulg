// Build script: takes tests/pap.mjs + reference/Lohnsteuer2026.xml and
// produces an inlinable JS snippet that defines `compilePap`, embeds the XML
// as a string, and exposes `__PAP_2026 = compilePap(XML)` ready for use.
//
// Run: node scripts/inline-pap.mjs
// Output: stdout (redirect to a file or paste into gehaltsabrechnung.html)

import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));
const papSrc = fs.readFileSync(path.join(root, 'tests/pap.mjs'), 'utf8');
const xml = fs.readFileSync(path.join(root, 'reference/Lohnsteuer2026.xml'), 'utf8');

// Strip the `export` keywords so the code lives at script scope.
let inlinePap = papSrc
  .replace(/^export function/gm, 'function')
  .replace(/^export class/gm, 'class')
  .replace(/^export const/gm, 'const')
  .replace(/^export \{[^}]*\};?$/gm, '');

// Escape XML for a JS template literal.
const xmlEscaped = xml
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out = `// ===== Inlined from tests/pap.mjs + reference/Lohnsteuer2026.xml =====
${inlinePap}
const PAP_XML_2026 = \`${xmlEscaped}\`;
const PAP_2026 = compilePap(PAP_XML_2026);
// ===== End of inlined PAP =====
`;

process.stdout.write(out);
