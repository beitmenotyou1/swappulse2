import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

function filesUnder(dir){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...filesUnder(p));else if(/\.(jsx|tsx)$/.test(e.name))out.push(p)}return out}
function tagName(n){return n?.openingElement?.name?.type==='JSXIdentifier'?n.openingElement.name.name:null}
function attr(n,name){return n.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name?.name===name)}
function attrString(n,name){const a=attr(n,name);return a?.value?.type==='StringLiteral'?a.value.value:null}
function isControl(n){return n?.type==='JSXElement'&&['input','textarea','select'].includes(tagName(n))}
function isLabel(n){return n?.type==='JSXElement'&&['label','Label'].includes(tagName(n))}
function hasText(n){return (n.children||[]).some(c=>c.type==='JSXText'?c.value.trim():c.type==='JSXExpressionContainer'&&c.expression?.type!=='JSXEmptyExpression')}
function insideLabel(p){let q=p.parentPath;while(q){if(q.isJSXElement()&&isLabel(q.node))return true;q=q.parentPath}return false}
function insertAttr(src,node,text){const o=node.openingElement;let at=o.end-1;if(src[at-1]==='/')at--;return {at,text:` ${text}`}}
function esc(s){return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}

let linked=0, placeholderNamed=0;
for(const file of filesUnder('src')){
 const src=fs.readFileSync(file,'utf8');let ast;try{ast=parse(src,{sourceType:'module',plugins:['jsx','typescript']})}catch{continue}
 const edits=[];const used=new Set();
 traverse(ast,{JSXElement(p){const n=p.node;if(!isControl(n))return;const type=attrString(n,'type');const cls=attrString(n,'className')||'';if(type==='hidden'||cls.includes('hidden'))return;if(attr(n,'aria-label')||attr(n,'aria-labelledby')||insideLabel(p))return;
   const id=attrString(n,'id');if(id){let found=false;traverse(ast,{JSXElement(lp){if(isLabel(lp.node)&&attrString(lp.node,'htmlFor')===id)found=true}});if(found)return;}
   const parent=p.parentPath?.node;if(parent?.type==='JSXElement'){
     const sib=parent.children||[];const idx=sib.indexOf(n);let lab=null;for(let i=idx-1;i>=0;i--){const s=sib[i];if(s.type==='JSXText'&&!s.value.trim())continue;if(isLabel(s)&&hasText(s))lab=s;break;}
     if(lab && !attr(lab,'htmlFor')){
       const ident=id||`a11y-${crypto.createHash('sha1').update(`${file}:${n.loc?.start.line}:${tagName(n)}`).digest('hex').slice(0,10)}`;
       edits.push(insertAttr(src,lab,`htmlFor="${ident}"`));if(!id)edits.push(insertAttr(src,n,`id="${ident}"`));linked++;used.add(n);return;
     }
   }
   const ph=attrString(n,'placeholder');if(ph){edits.push(insertAttr(src,n,`aria-label="${esc(ph)}"`));placeholderNamed++;used.add(n);}
 }});
 if(edits.length){edits.sort((a,b)=>b.at-a.at);let out=src;for(const e of edits)out=out.slice(0,e.at)+e.text+out.slice(e.at);fs.writeFileSync(file,out)}
}
console.log(`FORM_LINKED=${linked}`);console.log(`PLACEHOLDER_NAMED=${placeholderNamed}`);
