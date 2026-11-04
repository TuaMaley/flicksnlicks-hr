import {NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

export async function GET(){
 const u=await currentUser();
 if(!u)return NextResponse.json({error:'Unauthorized'},{status:401});
 const actor=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});
 if(!actor?.active||!actor.platformAdmin)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const now=new Date();
 const companies=await db.company.findMany({select:{id:true,name:true,code:true,active:true,
  memberships:{where:{active:true,user:{active:true}},select:{roles:{where:{role:{active:true}},select:{role:{select:{name:true,companyId:true}}}}}},
  modules:{where:{enabled:true},select:{moduleKey:true}},
  subscriptions:{select:{id:true,planName:true,status:true,startsAt:true,endsAt:true}}},
  orderBy:{name:'asc'}});
 const results=companies.map(c=>{
  const adminConfigured=c.memberships.some(m=>m.roles.some(r=>r.role.name==='Administrator'||r.role.name.startsWith('Administrator [')));
  const currentSubscriptions=c.subscriptions.filter(s=>s.status==='ACTIVE'&&s.startsAt<=now&&s.endsAt>now);
  const overlappingSubscriptions=currentSubscriptions.length>1;
  const subscriptionActive=currentSubscriptions.length>0;
  const enabledModules=c.modules.length;
  const issues=[...(!c.active?['COMPANY_INACTIVE']:[]),...(!adminConfigured?['ADMIN_MISSING']:[]),...(!subscriptionActive?['SUBSCRIPTION_MISSING_OR_EXPIRED']:[]),...(overlappingSubscriptions?['OVERLAPPING_ACTIVE_SUBSCRIPTIONS']:[]),...(!enabledModules?['MODULES_MISSING']:[])];
  return {companyId:c.id,companyName:c.name,companyCode:c.code,active:c.active,adminConfigured,subscriptionActive,enabledModules,subscriptionEndsAt:currentSubscriptions.length===1?currentSubscriptions[0].endsAt:null,issues,ready:issues.length===0};
 });
 return NextResponse.json({generatedAt:now.toISOString(),summary:{companies:results.length,ready:results.filter(c=>c.ready).length,requiresAttention:results.filter(c=>!c.ready).length},companies:results},{headers:{'Cache-Control':'private, no-store'}});
}
