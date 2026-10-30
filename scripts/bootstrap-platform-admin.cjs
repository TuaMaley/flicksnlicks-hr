const {PrismaClient}=require('@prisma/client');
const {scryptSync,randomBytes}=require('node:crypto');
const db=new PrismaClient();
(async()=>{
 const email='radjapong@nexora.com';
 const password=process.env.NEXORA_BOOTSTRAP_PASSWORD;
 if(!password||password.length<16)throw Error('Set NEXORA_BOOTSTRAP_PASSWORD (16+ characters) in this terminal, not in GitHub');
 const existing=await db.user.findUnique({where:{email}});
 if(existing)throw Error('Email already exists. Aborting to avoid promoting an existing account.');
 const count=await db.user.count({where:{platformAdmin:true}});
 if(count)throw Error('A platform administrator already exists. Aborting bootstrap.');
 const salt=randomBytes(16).toString('hex');
 const passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex');
 await db.user.create({data:{email,name:'Nexora Platform Administrator',passwordHash,platformAdmin:true,active:true}});
 console.log('Created dedicated platform administrator:',email);
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
