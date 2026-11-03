#!/usr/bin/env node
/* Read-only staging tenant isolation checks. No secrets or response bodies saved. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=(process.env.NEXORA_TEST_BASE_URL||'').replace(/\/$/,'');
const cookieA=process.env.NEXORA_TEST_TENANT_A_COOKIE;
const cookieB=process.env.NEXORA_TEST_TENANT_B_COOKIE;
const expectedA=process.env.NEXORA_TEST_TENANT_A_COMPANY_ID;
const expectedB=process.env.NEXORA_TEST_TENANT_B_COMPANY_ID;
const routes=[
 ['/api/branches','branches'],['/api/departments','departments'],
 ['/api/onboarding',null],['/api/disciplinary',null],['/api/pips','plans'],
 ['/api/recruitment/vacancies',null],['/api/appraisals/history',null]
];
const results=[];
function record(name,status,detail){results.push({name,status,detail});}
async function request(route,cookie){const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),12000);try{const response=await fetch(base+route,{headers:cookie?{cookie}: {},redirect:'manual',signal:ctrl.signal});let body=null;const type=response.headers.get('content-type')||'';if(type.includes('json'))body=await response.json().catch(()=>null);return {status:response.status,body};}finally{clearTimeout(timeout);}}
function findList(body,key){if(!body||typeof body!=='object')return null;if(key&&Array.isArray(body[key]))return body[key];if(Array.isArray(body))return body;const candidates=Object.entries(body).filter(([k,v])=>Array.isArray(v)&&!['permissions','modules'].includes(k));return candidates.length===1?candidates[0][1]:null;}
async function run(){
 if(!base||!/^https?:\/\//.test(base)){console.error('Set NEXORA_TEST_BASE_URL to your local or staging server');process.exitCode=2;return;}
 if(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)&&!process.env.NEXORA_TEST_ALLOW_REMOTE){console.error('Remote target requires NEXORA_TEST_ALLOW_REMOTE=1; use staging only');process.exitCode=2;return;}
 for(const [route] of routes){try{const r=await request(route);record('anonymous '+route,[401,403,302,307,308].includes(r.status)?'PASS':'FAIL','HTTP '+r.status);}catch(e){record('anonymous '+route,'FAIL',String(e.message||e));}}
 if(!cookieA||!cookieB||!expectedA||!expectedB||expectedA===expectedB){record('two-tenant isolation','NOT_RUN','Provide two distinct staging cookies and their expected company IDs');}
 else {
  for(const [route,key] of routes){try{
   const [a,b]=await Promise.all([request(route,cookieA),request(route,cookieB)]);
   if(a.status!==200||b.status!==200){record('tenant '+route,'REVIEW',`HTTP A=${a.status}, B=${b.status}; verify route permissions for both test users`);continue;}
   const listA=findList(a.body,key),listB=findList(b.body,key);
   if(!listA||!listB){record('tenant '+route,'REVIEW','Unrecognized list response; inspect ownership manually');continue;}
   const foreignA=listA.filter(x=>x&&typeof x==='object'&&typeof x.companyId==='string'&&x.companyId!==expectedA);
   const foreignB=listB.filter(x=>x&&typeof x==='object'&&typeof x.companyId==='string'&&x.companyId!==expectedB);
   const idsA=new Set(listA.map(x=>x?.id).filter(Boolean));const overlap=listB.filter(x=>x?.id&&idsA.has(x.id));
   const explicitA=listA.filter(x=>typeof x?.companyId==='string').length,explicitB=listB.filter(x=>typeof x?.companyId==='string').length;
   if(foreignA.length||foreignB.length||overlap.length)record('tenant '+route,'FAIL',`Foreign company IDs: A=${foreignA.length}, B=${foreignB.length}; overlapping record IDs=${overlap.length}`);
   else if(!explicitA&&!explicitB)record('tenant '+route,'REVIEW',`No direct companyId fields; A=${listA.length}, B=${listB.length}; requires fixture-level authorization tests`);
   else record('tenant '+route,'PASS',`Checked companyId on A=${explicitA}, B=${explicitB}; no overlapping IDs (empty lists are inconclusive)`);
  }catch(e){record('tenant '+route,'FAIL',String(e.message||e));}}
 }
 const counts=results.reduce((o,r)=>(o[r.status]=(o[r.status]||0)+1,o),{});
 const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:'phase10-live-isolation.json';
 fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),target:base,counts,checks:results},null,2));
 console.log('Phase 10 live isolation:',JSON.stringify(counts),'report:',output);
 if(counts.FAIL)process.exitCode=1;
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
module.exports={findList};
