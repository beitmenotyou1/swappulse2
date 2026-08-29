import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

function filesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(p));
    else if (/\.(jsx|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function attr(el, name) {
  return el.openingElement.attributes.find(a => a.type === 'JSXAttribute' && a.name?.name === name);
}
function literalAttr(el, name) {
  const a = attr(el, name);
  if (!a?.value) return null;
  if (a.value.type === 'StringLiteral') return a.value.value;
  return null;
}
function nodeHasAccessibleText(node) {
  if (!node) return false;
  if (node.type === 'JSXText') return node.value.trim().length > 0;
  if (node.type === 'JSXExpressionContainer') {
    const e = node.expression;
    if (!e || e.type === 'JSXEmptyExpression') return false;
    // Runtime expressions may resolve to visible labels. Treat them as text
    // unless they are an element-only expression.
    return e.type !== 'JSXElement' && e.type !== 'JSXFragment';
  }
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    return (node.children || []).some(nodeHasAccessibleText);
  }
  return false;
}
function hasAccessibleChild(el) {
  return el.children.some(nodeHasAccessibleText);
}
function loc(file, node) { return `${file}:${node.loc?.start.line || '?'}`; }

const issues = [];
for (const file of filesUnder('src')) {
  let ast;
  try {
    ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    issues.push({ type: 'PARSE', location: file, detail: e.message });
    continue;
  }
  traverse(ast, {
    JSXElement(p) {
      const el = p.node;
      const name = el.openingElement.name;
      if (name.type !== 'JSXIdentifier') return;
      const tag = name.name;
      if (tag === 'button') {
        const named = attr(el, 'aria-label') || attr(el, 'aria-labelledby') || attr(el, 'title');
        if (!named && !hasAccessibleChild(el)) {
          const source = fs.readFileSync(file, 'utf8');
          const snippet = source.slice(el.start, Math.min(el.end, el.start + 220)).replace(/\s+/g, ' ').trim();
          issues.push({ type: 'ICON_BUTTON_NO_NAME', location: loc(file, el), detail: snippet });
        }
      }
      if (tag === 'a') {
        const target = literalAttr(el, 'target');
        if (target === '_blank') {
          const rel = literalAttr(el, 'rel') || '';
          if (!rel.includes('noopener')) issues.push({ type: 'BLANK_LINK_NO_NOOPENER', location: loc(file, el), detail: `rel=${JSON.stringify(rel)}` });
        }
      }
      if (tag === 'img' && !attr(el, 'alt')) {
        issues.push({ type: 'IMG_NO_ALT', location: loc(file, el), detail: 'img missing alt' });
      }
      if (tag === 'iframe' && !attr(el, 'title')) {
        issues.push({ type: 'IFRAME_NO_TITLE', location: loc(file, el), detail: 'iframe missing title' });
      }
    }
  });
}

const grouped = issues.reduce((m, i) => ((m[i.type] ||= []).push(i), m), {});
for (const [type, rows] of Object.entries(grouped)) {
  console.log(`\n${type}=${rows.length}`);
  for (const r of rows.slice(0, 200)) console.log(`${r.location} ${r.detail}`);
}
console.log(`\nTOTAL=${issues.length}`);
