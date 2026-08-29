import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

function filesUnder(dir) {
  const out=[];
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (/\.(jsx|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
function attr(node,name){return node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name?.name===name)}
function tagName(node){return node?.openingElement?.name?.type==='JSXIdentifier'?node.openingElement.name.name:null}
function isInsideLabel(path){let p=path.parentPath;while(p){if(p.isJSXElement()&&tagName(p.node)==='label')return true;p=p.parentPath}return false}
function loc(file,node){return `${file}:${node.loc?.start.line||'?'}`}
const issues=[];
for(const file of filesUnder('src')){
 let ast;try{ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx','typescript']})}catch{continue}
 traverse(ast,{JSXElement(p){const el=p.node;const tag=tagName(el);
   if(tag==='label'){
     const hasFor=!!attr(el,'htmlFor');
     const wraps=el.children.some(c=>c.type==='JSXElement'&&['input','textarea','select'].includes(tagName(c)));
     if(!hasFor&&!wraps) issues.push({type:'LABEL_NO_ASSOC',location:loc(file,el)});
   }
   if(['input','textarea','select'].includes(tag)){
     const named=attr(el,'aria-label')||attr(el,'aria-labelledby')||attr(el,'id')||attr(el,'title');
     const hidden=(attr(el,'type')?.value?.value==='hidden')||String(attr(el,'className')?.value?.value||'').includes('hidden');
     if(!named&&!hidden&&!isInsideLabel(p)) issues.push({type:'CONTROL_NO_NAME',location:loc(file,el),tag});
   }
 }});
}
const grouped=issues.reduce((m,i)=>((m[i.type]||=[]).push(i),m),{});
for(const [type,rows] of Object.entries(grouped)){console.log(`\n${type}=${rows.length}`);for(const r of rows.slice(0,250))console.log(`${r.location}${r.tag?' '+r.tag:''}`)}
console.log(`\nTOTAL=${issues.length}`);
