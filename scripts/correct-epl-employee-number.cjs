/** One-time optional correction: PREVIEW by default. Run only after reviewing output. */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
 const apply = process.argv.includes('--apply');
 const company = await db.company.findUnique({ where: { code: 'EP001' } });
 if (!company) throw Error('Everything Podcast (EP001) not found; no changes made');
 const people = await db.employee.findMany({ where: { companyId: company.id }, select: { id:true,employeeNo:true,firstName:true,lastName:true,email:true }, orderBy:{createdAt:'asc'} });
 const target = people.find(p => p.firstName.toLowerCase()==='nuna' && p.lastName.toLowerCase()==='targbor' && p.employeeNo==='FNL-00051');
 if (!target) { console.log('Target employee not found with expected company/name/old ID; no changes made'); return; }
 const taken = await db.employee.findUnique({ where: { employeeNo:'EPL-00001' } });
 if (taken) { console.log('EPL-00001 already exists; no changes made'); return; }
 console.log({ action: apply?'APPLY':'PREVIEW',company:company.name,employee:target.email,from:target.employeeNo,to:'EPL-00001' });
 if (!apply) { console.log('Review the preview and run with --apply only if correct.'); return; }
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(78001234)`;
  const again=await tx.employee.findUnique({where:{id:target.id}});
  if (again?.companyId!==company.id || again.employeeNo!=='FNL-00051') throw Error('Record changed; abort');
  if (await tx.employee.findUnique({where:{employeeNo:'EPL-00001'}})) throw Error('Target number already taken');
  await tx.employee.update({where:{id:target.id},data:{employeeNo:'EPL-00001'}});
  await tx.auditLog.create({data:{companyId:company.id,action:'EMPLOYEE_NUMBER_CORRECTED',entity:'Employee',entityId:target.id,detail:{from:'FNL-00051',to:'EPL-00001',reason:'Correct company prefix; manual administrator-reviewed operation'}}});
 });
 console.log('Updated. Verify employee profile and integrations referencing the display ID.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
