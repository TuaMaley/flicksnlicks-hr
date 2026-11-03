#!/usr/bin/env node
/* Nexora Phase 10: non-destructive API security verification.
   Requires a running local/staging server and optional test identities.
   Never issues mutating requests. Exit nonzero on failed checks. */
const fs=require('node:fs');
const path=require('node:path');
const ROOT=process.cwd();
const API=path.join(ROOT,'app','api');
const BASE=process.env.NEXORA_TEST_BASE_URL;
const paths=[
'/access/audit','/access/reports','/access/reviews','/access/security',
'/appraisals/analytics','/appraisals/history','/appraisals/reports',
'/branches','/branches/manage','/departments',
'/disciplinary','/disciplinary/analytics','/disciplinary/phase4',
'/onboarding','/onboarding/analytics','/onboarding/exits',
'/payroll/compensation','/payroll/compensation/bulk',
'/pips','/pips/employees',
'/platform/access-reviews/decisions','/platform/activation','/platform/billing','/platform/licensing','/platform/plans','/platform/settings','/platform/subscription-lifecycle','/platform/subscriptions',
'/recruitment/assessments','/recruitment/offers','/recruitment/requisitions','/recruitment/vacancies'
];
const dynamic=[
'/appraisals/reviews/[id]','/disciplinary/[id]','/disciplinary/[id]/phase2','/disciplinary/[id]/phase2/[recordId]',
'/onboarding/[id]/tasks','/onboarding/exits/[id]/finalize','/onboarding/exits/[id]/tasks',
'/payroll/compensation/[id]','/pips/[id]','/recruitment/applications/[id]','/recruitment/interviews/[id]',
'/recruitment/requisitions/[id]','/recruitment/vacancies/[id]'
];
const checks=[];
function add(name,status,detail){checks.push({name,status,detail});}
function fileFor(route){return path.join(API,...route.split('/').filter(Boolean),'route.ts');}
for(const route of [...paths,...dynamic]){
 const file=fileFor(route);
 if(!fs.existsSync(file)){add(route,'FAIL','Route source missing');continue;}
 const source=fs.readFileSync(file,'utf8');
 const hasAuth=/\b(access|currentUser|securityAdmin|branchManagerAccess|selectedCompany|compensationAccess|guard|auth)\s*\(/.test(source)||/from ['"][^'"]*auth/.test(source);
 add(route,hasAuth?'REVIEW':'FAIL',hasAuth?'Authentication reference found; authorization and tenant scope still require inspection':'No recognizable authentication reference');
}
async function get(url,cookie){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url,{method:'GET',headers:cookie?{Cookie:cookie}:{},redirect:'manual',signal:controller.signal});return {status:r.status,body:await r.text()};}finally{clearTimeout(t);}}
async function main(){
 if(BASE){
  const anonymous=[...paths].filter(x=>!x.startsWith('/platform/'));
  for(const route of anonymous){
   try{const r=await get(BASE.replace(/\/$/,'')+'/api'+route,'');
    add('anonymous GET '+route,([401,403,302,307,308].includes(r.status))?'PASS':'FAIL','HTTP '+r.status);
   }catch(e){add('anonymous GET '+route,'FAIL',String(e.message||e));}
  }
  const a=process.env.NEXORA_TEST_TENANT_A_COOKIE;
  const b=process.env.NEXORA_TEST_TENANT_B_COOKIE;
  if(a&&b){
   // These comparisons are diagnostic only. Different payloads are not proof of isolation.
   for(const route of ['/api/branches','/api/departments','/api/onboarding','/api/disciplinary','/api/pips','/api/recruitment/vacancies']){
    try{const [x,y]=await Promise.all([get(BASE+route,a),get(BASE+route,b)]);
     add('tenant A/B GET '+route,'REVIEW',`A HTTP ${x.status}, B HTTP ${y.status}; inspect returned record ownership manually`);
    }catch(e){add('tenant A/B GET '+route,'FAIL',String(e.message||e));}
   }
  }else add('cross-tenant live test','NOT_RUN','Provide two isolated staging-session cookies to compare tenant responses');
 }else add('live API tests','NOT_RUN','Set NEXORA_TEST_BASE_URL to a staging server URL');
 const report={generatedAt:new Date().toISOString(),routesReviewed:paths.length+dynamic.length,counts:checks.reduce((a,c)=>(a[c.status]=(a[c.status]||0)+1,a),{}),checks};
 const out=path.resolve(process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:'phase10-security-validation.json');
 fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(`Phase 10 security validation: ${JSON.stringify(report.counts)}; report: ${out}`);
 if(checks.some(x=>x.status==='FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
