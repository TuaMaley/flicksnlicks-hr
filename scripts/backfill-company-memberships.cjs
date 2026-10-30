/* Preview-first, additive membership backfill for users linked to FNL employees.
   No passwords, roles, employees, or operational records are modified. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 const code=process.env.NEXORA_COMPANY_CODE||'FNL001';
 const company=await db.company.findUnique({where:{code}});
 if(!company||!company.active)throw Error('Target company missing or inactive');
 const users=await db.user.findMany({where:{active:true,employeeId:{not:null},employee:{companyId:company.id}},select:{id:true,email:true,employeeId:true,companyMemberships:{select:{companyId:true,active:true}}}});
 const missing=users.filter(u=>!u.companyMemberships.some(m=>m.companyId===company.id&&m.active));
 const existing=users.length-missing.length;
 const unlinked=await db.user.count({where:{active:true,employeeId:null,platformAdmin:false}});
 console.log(JSON.stringify({company:code,eligibleLinkedUsers:users.length,alreadyActive:existing,toCreateOrReactivate:missing.map(u=>({email:u.email,employeeId:u.employeeId})),unlinkedAccountsRequireManualReview:unlinked},null,2));
 if(process.env.NEXORA_MEMBERSHIP_CONFIRM!==code){console.log('DRY RUN ONLY. To apply, set NEXORA_MEMBERSHIP_CONFIRM='+code);return;}
 let created=0,reactivated=0;
 for(const u of missing){const before=u.companyMemberships.find(m=>m.companyId===company.id);await db.companyMembership.upsert({where:{companyId_userId:{companyId:company.id,userId:u.id}},create:{companyId:company.id,userId:u.id,active:true},update:{active:true}});if(before)reactivated++;else created++;}
 console.log(JSON.stringify({created,reactivated,skipped:existing}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
