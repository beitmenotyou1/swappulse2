import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

function filesUnder(dir){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...filesUnder(p));else if(/\.(jsx|tsx)$/.test(e.name))out.push(p)}return out}
function tagName(n){return n?.openingElement?.name?.type==='JSXIdentifier'?n.openingElement.name.name:null}
function attr(n,name){return n.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name?.name===name)}
function attrString(n,name){const a=attr(n,name);return a?.value?.type==='StringLiteral'?a.value.value:null}
function isControl(n){return n?.type==='JSXElement'&&['input','textarea','select'].includes(tagName(n))}
function isLabel(n){return n?.type==='JSXElement'&&['label','Label'].includes(tagName(n))}
function hasText(n){if(!n)return false;return (n.children||[]).some(c=>c.type==='JSXText'?c.value.trim():c.type==='JSXExpressionContainer'&&c.expression?.type!=='JSXEmptyExpression')}
function textOf(n){let s='';for(const c of n.children||[]){if(c.type==='JSXText')s+=c.value+' ';else if(c.type==='JSXExpressionContainer'&&c.expression?.type==='StringLiteral')s+=c.expression.value+' ';}return s.replace(/\s+/g,' ').trim()}
function insideLabel(p){let q=p.parentPath;while(q){if(q.isJSXElement()&&isLabel(q.node))return true;q=q.parentPath}return false}
function loc(file,n){return `${file}:${n.loc?.start.line||'?'}`}

const rows=[];
for(const file of filesUnder('src')){
 let ast;try{ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx','typescript']})}catch{continue}
 traverse(ast,{JSXElement(p){const n=p.node;if(!isControl(n))return;const type=attrString(n,'type');const cls=attrString(n,'className')||'';if(type==='hidden'||cls.includes('hidden'))return;
   if(attr(n,'aria-label')||attr(n,'aria-labelledby')||insideLabel(p))return;
   const id=attrString(n,'id');
   if(id){
     // count as named only when some label in file references this id
     let found=false;traverse(ast,{JSXElement(lp){if(!isLabel(lp.node))return;const f=attrString(lp.node,'htmlFor');if(f===id)found=true;}});if(found)return;
   }
   const parent=p.parentPath?.node;if(parent?.type==='JSXElement'){
     const siblings=parent.children||[];const idx=siblings.indexOf(n);
     for(let i=idx-1;i>=0;i--){const s=siblings[i];if(s.type==='JSXText'&&!s.value.trim())continue;if(isLabel(s)&&hasText(s)){rows.push({type:'ADJACENT_LABEL_UNBOUND',location:loc(file,n),label:textOf(s),tag:tagName(n)});return}break;}
   }
   const ph=attrString(n,'placeholder');
   if(ph){rows.push({type:'PLACEHOLDER_ONLY',location:loc(file,n),label:ph,tag:tagName(n)});return}
   rows.push({type:'UNNAMED_CONTROL',location:loc(file,n),tag:tagName(n)});
 }});
}
const grouped=rows.reduce((m,r)=>((m[r.type]||=[]).push(r),m),{});for(const [type,rs] of Object.entries(grouped)){console.log(`\n${type}=${rs.length}`);for(const r of rs)console.log(`${r.location} ${r.tag} ${JSON.stringify(r.label||'')}`)}console.log(`\nTOTAL=${rows.length}`);
