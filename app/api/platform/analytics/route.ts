import {NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

export const dynamic='force-dynamic';
export async function GET(){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const actor=await db.user.findUnique({where:{id:user.id},select:{active:true,platformAdmin:true}});
 if(!actor?.active||!actor.platformAdmin)return NextResponse.json({error:'Platform administrator required'},{status:403});
 const now=new Date();const horizon=new Date(now);horizon.setDate(horizon.getDate()+30);
 const since=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11,1));
 const [companies,subscriptions,plans,modules,invoiceGroups,paymentGroups,invoicesRecent,paymentsRecent]=await Promise.all([
  db.company.findMany({select:{id:true,name:true,code:true,active:true,createdAt:true,_count:{select:{memberships:true}}},orderBy:{name:'asc'}}),
  db.platformSubscription.findMany({select:{id:true,companyId:true,planName:true,status:true,startsAt:true,endsAt:true}}),
  db.subscriptionPlan.findMany({select:{name:true,monthlyPrice:true,annualPrice:true,currency:true,active:true}}),
  db.companyModule.findMany({where:{enabled:true},select:{companyId:true,moduleKey:true}}),
  db.nexoraInvoice.groupBy({by:['currency','status'],_sum:{amountMinor:true},_count:{_all:true}}),
  db.nexoraPayment.groupBy({by:['currency'],_sum:{amountMinor:true},_count:{_all:true}}),
  db.nexoraInvoice.findMany({where:{issuedAt:{gte:since}},select:{id:true,companyId:true,currency:true,amountMinor:true,issuedAt:true,dueAt:true,status:true,payments:{select:{amountMinor:true}}}}),
  db.nexoraPayment.findMany({where:{paidAt:{gte:since}},select:{companyId:true,currency:true,amountMinor:true,paidAt:true}})
 ]);
 const activeSubs=subscriptions.filter(s=>s.status==='ACTIVE'&&s.startsAt<=now&&s.endsAt>now);
 const activeIds=new Set(activeSubs.map(s=>s.companyId));
 const expiring=activeSubs.filter(s=>s.endsAt<=horizon).sort((a,b)=>a.endsAt.getTime()-b.endsAt.getTime());
 const byCurrency:Record<string,{invoicedMinor:number;collectedMinor:number;invoiceCount:number;paymentCount:number}>={};
 for(const g of invoiceGroups){const row=byCurrency[g.currency]??={invoicedMinor:0,collectedMinor:0,invoiceCount:0,paymentCount:0};if(g.status!=='VOID'){row.invoicedMinor+=g._sum.amountMinor??0;row.invoiceCount+=g._count._all;}}
 for(const g of paymentGroups){const row=byCurrency[g.currency]??={invoicedMinor:0,collectedMinor:0,invoiceCount:0,paymentCount:0};row.collectedMinor+=g._sum.amountMinor??0;row.paymentCount+=g._count._all;}
 const months=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(since.getUTCFullYear(),since.getUTCMonth()+i,1));return d.toISOString().slice(0,7)});
 const monthly:Record<string,Record<string,{invoicedMinor:number;collectedMinor:number}>>={};
 function bucket(month:string,currency:string){const m=monthly[month]??={};return m[currency]??={invoicedMinor:0,collectedMinor:0};}
 for(const i of invoicesRecent){if(i.status!=='VOID')bucket(i.issuedAt.toISOString().slice(0,7),i.currency).invoicedMinor+=i.amountMinor;}
 for(const p of paymentsRecent)bucket(p.paidAt.toISOString().slice(0,7),p.currency).collectedMinor+=p.amountMinor;
 const moduleAdoption=Object.entries(modules.reduce<Record<string,Set<string>>>((a,m)=>{(a[m.moduleKey]??=new Set()).add(m.companyId);return a;},{})).map(([moduleKey,ids])=>({moduleKey,companies:ids.size})).sort((a,b)=>b.companies-a.companies);
 const companyRows=companies.map(c=>({id:c.id,name:c.name,code:c.code,active:c.active,createdAt:c.createdAt,memberships:c._count.memberships,enabledModules:modules.filter(m=>m.companyId===c.id).length,subscriptionActive:activeIds.has(c.id),plan:activeSubs.find(s=>s.companyId===c.id)?.planName??null}));
 const planAdoption=Object.entries(activeSubs.reduce<Record<string,number>>((a,s)=>{a[s.planName]=(a[s.planName]??0)+1;return a;},{})).map(([name,count])=>({name,count}));
 // Outstanding balances are computed from all non-void invoices, not from a limited 500-row billing feed.
 const balances=await db.nexoraInvoice.findMany({where:{status:{not:'VOID'}},select:{id:true,companyId:true,currency:true,amountMinor:true,dueAt:true,payments:{select:{amountMinor:true}}}});
 const receivables:Record<string,{outstandingMinor:number;overdueMinor:number}>={};
 for(const i of balances){const paid=i.payments.reduce((s,p)=>s+p.amountMinor,0);const due=Math.max(0,i.amountMinor-paid);const row=receivables[i.currency]??={outstandingMinor:0,overdueMinor:0};row.outstandingMinor+=due;if(i.dueAt<now)row.overdueMinor+=due;}
 return NextResponse.json({generatedAt:now.toISOString(),summary:{companies:companies.length,activeCompanies:companies.filter(c=>c.active).length,activeSubscriptions:activeSubs.length,expiring30Days:expiring.length,plans:plans.length},companyRows,expiring:expiring.map(s=>({...s,companyName:companies.find(c=>c.id===s.companyId)?.name??'Unknown'})),byCurrency,receivables,months,monthly,planAdoption,moduleAdoption},{headers:{'Cache-Control':'private, no-store'}});
}
