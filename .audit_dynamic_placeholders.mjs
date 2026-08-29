import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;
function filesUnder(dir){const o=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())o.push(...filesUnder(p));else if(/\.(jsx|tsx)$/.test(e.name))o.push(p)}return o}
function attr(n,name){return n.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name?.name===name)}
function tag(n){return n?.openingElement?.name?.type==='JSXIdentifier'?n.openingElement.name.name:null}
let count=0;
for(const file of filesUnder('src')){const src=fs.readFileSync(file,'utf8');let ast;try{ast=parse(src,{sourceType:'module',plugins:['jsx','typescript']})}catch{continue}const edits=[];traverse(ast,{JSXElement(p){const n=p.node;if(!['input','textarea','select'].includes(tag(n)))return;if(attr(n,'aria-label')||attr(n,'aria-labelledby'))return;const ph=attr(n,'placeholder');if(!ph?.value||ph.value.type==='StringLiteral')return;const raw=src.slice(ph.value.start,ph.value.end);const o=n.openingElement;let at=o.end-1;if(src[at-1]==='/')at--;edits.push({at,text:` aria-label=${raw}`});count++;}});edits.sort((a,b)=>b.at-a.at);let out=src;for(const e of edits)out=out.slice(0,e.at)+e.text+out.slice(e.at);if(edits.length)fs.writeFileSync(file,out)}
console.log(`DYNAMIC_PLACEHOLDER_NAMED=${count}`);
