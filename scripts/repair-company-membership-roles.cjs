// One-time repair for single-company users only. Run preview before apply.
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function main(){
 const apply=process.argv[2]==='apply';
 const memberships=await db.companyMembership.findMany({where:{active:true,company:{active:true}},include:{roles:true,user:{include:{roles:{include:{role:true}},companyMemberships:true}}}});
 let eligible=0,skipped=0;
 for(const m of memberships){
  if(m.roles.length || m.user.companyMemberships.length!==1 || m.user.platformAdmin){skipped++;continue}
  const roles=m.user.roles.filter(r=>r.role.active&&(r.role.companyId===m.companyId||r.role.companyId===null));
  if(!roles.length){skipped++;continue}
  eligible++;console.log((apply?'APPLY':'PREVIEW'),m.companyId,m.userId,roles.map(r=>r.role.name).join(','));
  if(apply)await db.$transaction(async tx=>{
   const current=await tx.companyMembershipRole.count({where:{membershipId:m.id}});
   if(current) return;
   await tx.companyMembershipRole.createMany({data:roles.map(r=>({membershipId:m.id,roleId:r.roleId})),skipDuplicates:true});
  });
 }
 console.log({mode:apply?'apply':'preview',eligible,skipped});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
