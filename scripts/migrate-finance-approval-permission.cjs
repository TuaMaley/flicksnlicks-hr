#!/usr/bin/env node
// Preview by default. Apply only after reviewing output and taking a backup.
// Usage: node scripts/migrate-finance-approval-permission.cjs preview|apply
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const mode=process.argv[2]||'preview';
if(!['preview','apply'].includes(mode)){console.error('Usage: node scripts/migrate-finance-approval-permission.cjs preview|apply');process.exit(2)}
const eligible=new Set(['Finance','Finance Officer','Finance Manager','Administrator']);
function isFinanceRole(r){const n=r.name.replace(/\s*\[[^\]]+\]\s*$/,'').trim();return eligible.has(n)}
async function main(){
 const roles=await db.role.findMany({where:{active:true,companyId:{not:null}},select:{id:true,name:true,companyId:true,permissions:{select:{permission:{select:{key:true}}}}},orderBy:{name:'asc'}});
 const targets=roles.filter(isFinanceRole);
 const ambiguous=roles.filter(r=>!isFinanceRole(r)&&/finance|account|administrator/i.test(r.name));
 console.log(JSON.stringify({mode,permission:'payroll.finance_approve',grantTo:targets.map(r=>({name:r.name,companyId:r.companyId,alreadyGranted:r.permissions.some(p=>p.permission.key==='payroll.finance_approve')})),manualReview:ambiguous.map(r=>({name:r.name,companyId:r.companyId})),note:'No permissions are removed; HR-only roles receive no Finance permission.'},null,2));
 if(mode==='preview')return;
 if(!targets.length)throw Error('No eligible company-scoped Finance/Administrator roles found. No changes applied.');
 await db.$transaction(async tx=>{
  const perm=await tx.permission.upsert({where:{key:'payroll.finance_approve'},create:{key:'payroll.finance_approve',description:'Approve Finance payroll stage and manage payroll payments'},update:{}});
  for(const role of targets){await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:perm.id}},create:{roleId:role.id,permissionId:perm.id},update:{}})}
 });
 console.log('Applied grants to '+targets.length+' company-scoped roles. Review ambiguous roles manually before rollout.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
