import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
try {for(const name of ['East Legon','Dansoman','Haatso','Kingsby','T-Junction','Head Office']) await db.branch.upsert({where:{name},update:{},create:{name}}); console.log('Branch list synchronized');} finally {await db.$disconnect()}
