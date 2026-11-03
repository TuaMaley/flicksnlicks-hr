#!/usr/bin/env node
'use strict';
// Read-only source audit. Does not connect to a database or modify application files.
const fs=require('node:fs');const path=require('node:path');
const root=process.cwd();const api=path.join(root,'app','api');
const groups=['platform','access','account','auth','employees','payroll','leave','appraisals','recruitment','onboarding','training','disciplinary','self-service','pips','dashboard','branches','departments','roles','users'];
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='route.ts'?[path.join(dir,e.name)]:[])}
function analyze(source,route){
 const methods=[...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)].map(m=>m[1]);
 const access=/\baccess\s*\(|\bcurrentUser\s*\(|\brequire[A-Z]\w*\s*\(|\bauth\s*\(/.test(source);
 const tenant=/\bcompanyId\b|\bactiveTenant\b|\btenant\b/.test(source);
 const permission=/\.can\s*\(|\bpermissions?\b|\bisHR\s*\(|\bisAdmin\s*\(/.test(source);
 const query=/\bdb\.[a-zA-Z]+\.(findMany|findFirst|findUnique|update|delete|create|upsert|count|aggregate|groupBy)\s*\(/.test(source);
 const sensitive=/^\/(employees|payroll|leave|appraisals|recruitment|onboarding|training|disciplinary|self-service|pips|users|roles|access|platform|branches|departments)(\/|$)/.test(route);
 const flags=[];
 if(sensitive&&!access)flags.push('REVIEW_AUTH_GUARD');
 if(sensitive&&query&&!tenant)flags.push('REVIEW_TENANT_SCOPE');
 if(sensitive&&methods.some(x=>x!=='GET')&&!permission)flags.push('REVIEW_WRITE_PERMISSION');
 return {route,methods,hasAuthSignal:access,hasTenantSignal:tenant,hasPermissionSignal:permission,hasDirectDbQuery:query,flags};
}
function run(){if(!fs.existsSync(api))throw Error('Run from Nexora project root (app/api missing)');
 const routes=walk(api).map(f=>analyze(fs.readFileSync(f,'utf8'),'/'+path.relative(api,path.dirname(f)).split(path.sep).join('/'))).sort((a,b)=>a.route.localeCompare(b.route));
 const flagged=routes.filter(x=>x.flags.length);const groupStats=groups.map(group=>({group,total:routes.filter(x=>x.route==='/'+group||x.route.startsWith('/'+group+'/')).length,flagged:flagged.filter(x=>x.route==='/'+group||x.route.startsWith('/'+group+'/')).length})).filter(x=>x.total);
 const report={generatedAt:new Date().toISOString(),auditType:'STATIC_HEURISTIC_REVIEW_ONLY',scope:'app/api/**/route.ts',summary:{totalRoutes:routes.length,flaggedRoutes:flagged.length,unflaggedRoutes:routes.length-flagged.length},groupStats,routes,limitations:['Pattern matching is not a security proof.','Auth and tenant checks may be delegated to helpers, causing false positives.','Presence of companyId does not prove correct isolation, causing false negatives.','Does not execute workflows, use credentials, query a database, or verify Railway deployment.']};
 const out=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:null;
 if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
 console.log(`Phase 10 source review: ${routes.length} API routes; ${flagged.length} require manual review (heuristic).`);
 for(const g of groupStats)console.log(`${g.group.padEnd(17)} ${String(g.total).padStart(3)} routes | ${g.flagged} flagged`);
 console.log('\nFlagged routes:');for(const r of flagged)console.log(` ${r.route}: ${r.flags.join(', ')}`);
 console.log('\nThis audit does NOT establish tenant isolation or end-to-end test success.');
 return report;
}
if(require.main===module){try{run()}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={analyze,run};
