#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const checks=[];
function check(name,ok,detail){checks.push({name,status:ok?'PASS':'REVIEW',detail});}
function exists(p){return fs.existsSync(path.join(root,p));}
for(const p of ['prisma/schema.prisma','app/api/health/route.ts','app/api/platform/route.ts','app/api/platform/activation/route.ts','app/api/platform/subscriptions/route.ts','app/api/platform/readiness/route.ts','app/api/platform/audit/route.ts'])check('source '+p,exists(p),exists(p)?'Present':'Missing');
const envFile=path.join(root,'.env.example');
check('example environment',fs.existsSync(envFile),'Ensure production secrets are stored only in Railway variables');
check('database backup',false,'Manually verify Railway PostgreSQL backups and restore drill; no database access performed');
check('tenant isolation',false,'Phase 10 authenticated isolation remains deferred; not a launch clearance');
check('monitoring',false,'Manually configure Railway health alerts, error monitoring, and incident contacts');
const counts=checks.reduce((o,c)=>(o[c.status]=(o[c.status]||0)+1,o),{});
const report={generatedAt:new Date().toISOString(),phase:11,checks,counts,warning:'Static readiness review only. Does not certify security or deployment readiness.'};
const index=process.argv.indexOf('--output');
if(index>=0){const out=process.argv[index+1];if(!out||out.startsWith('--')){console.error('Missing --output filename');process.exit(2);}fs.writeFileSync(path.resolve(out),JSON.stringify(report,null,2)+'\n');}
console.log('Phase 11 readiness:',JSON.stringify(counts));
