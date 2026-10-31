// Run once after prisma db push; does not modify existing branches.
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{for(const company of await db.company.findMany({select:{id:true,name:true}})){const existing=await db.branch.findFirst({where:{companyId:company.id,name:'Head Office'}});if(!existing){await db.branch.create({data:{companyId:company.id,name:'Head Office'}});console.log('Created Head Office for',company.name)}else console.log('Already exists:',company.name)}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
