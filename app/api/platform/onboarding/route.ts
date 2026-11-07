import {validateCompanyLogo} from '../../../../lib/companyLogo';
import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

import {randomUUID} from 'node:crypto';
async function guard(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
export async function GET(){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const [companies,plans]=await Promise.all([
  db.company.findMany({select:{id:true,name:true,code:true,active:true,createdAt:true,memberships:{where:{active:true,user:{active:true}},select:{roles:{select:{role:{select:{name:true}}}}}},modules:{where:{enabled:true},select:{moduleKey:true}},subscriptions:{select:{id:true,planName:true,status:true,startsAt:true,endsAt:true}}},orderBy:{createdAt:'desc'}}),
  db.subscriptionPlan.findMany({where:{active:true},select:{id:true,name:true,currency:true,moduleKeys:true},orderBy:{name:'asc'}})
 ]);
 const now=new Date();
 return NextResponse.json({plans,companies:companies.map(c=>{
  const admin=c.memberships.some(m=>m.roles.some(r=>r.role.name==='Administrator'||r.role.name.startsWith('Administrator [')));
  const sub=c.subscriptions.some(s=>s.status==='ACTIVE'&&s.startsAt<=now&&s.endsAt>now);
  const ready=admin&&sub&&c.modules.length>0;
  return {id:c.id,name:c.name,code:c.code,active:c.active,createdAt:c.createdAt,adminConfigured:admin,subscriptionActive:sub,enabledModules:c.modules.length,ready,status:!c.active?'SUSPENDED':ready?'ACTIVE':'PENDING'};
 })},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const u=await guard();if(!u)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const b=await req.json().catch(()=>null);
 const required=['name','registrationNumber','companyType','taxIdentifier','businessAddress','digitalAddress','phone','email','industry','contactName','contactPosition','contactPhone','contactEmail'];
 const values:Record<string,string>={};
 for(const key of [...required,'website'])values[key]=typeof b?.[key]==='string'?b[key].trim():'';
 if(required.some(k=>!values[k]||values[k].length>500)||values.name.length<2||values.name.length>120||values.website.length>254)return NextResponse.json({error:'Complete all required company and contact fields.'},{status:400});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail))return NextResponse.json({error:'Enter valid email addresses'},{status:400});
 if(values.website){try{const url=new URL(values.website);if(!['https:','http:'].includes(url.protocol))throw Error('invalid')}catch{return NextResponse.json({error:'Enter a valid website URL'},{status:400})}}
 let logoDataUrl:string|null;try{logoDataUrl=validateCompanyLogo(b?.logoDataUrl)}catch(e){return NextResponse.json({error:(e as Error).message},{status:400})}
 try{
  const duplicate=await db.company.findFirst({where:{OR:[{registrationNumber:{equals:values.registrationNumber,mode:'insensitive'}},{taxIdentifier:{equals:values.taxIdentifier,mode:'insensitive'}}]},select:{id:true}});
  if(duplicate)return NextResponse.json({error:'A company with this registration number or Ghana Card/TIN already exists.'},{status:409});
  const company=await db.$transaction(async tx=>{
  const code='NX'+(await tx.company.count()+1).toString().padStart(5,'0')+'-'+randomUUID().slice(0,6).toUpperCase();
  const c=await tx.company.create({data:{name:values.name,code,country:'Ghana',registrationNumber:values.registrationNumber,companyType:values.companyType,taxIdentifier:values.taxIdentifier,businessAddress:values.businessAddress,digitalAddress:values.digitalAddress,phone:values.phone,email:values.email,industry:values.industry,contactName:values.contactName,contactPosition:values.contactPosition,contactPhone:values.contactPhone,contactEmail:values.contactEmail,website:values.website||null,logoDataUrl,active:true}});
  await tx.branch.create({data:{companyId:c.id,name:'Head Office'}});
  await tx.auditLog.create({data:{actorId:u.id,companyId:c.id,action:'PLATFORM_COMPANY_REGISTERED',entity:'Company',entityId:c.id,detail:{code:c.code,registrationNumber:values.registrationNumber}}});return c;
 });return NextResponse.json({success:true,companyId:company.id,code:company.code},{status:201})}
 catch(e){console.error('Company registration failed',e);return NextResponse.json({error:'Unable to register company. Verify unique business details and retry.'},{status:500})}
}
