import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {Prisma} from '@prisma/client';

const reply=(error:string,status=400)=>NextResponse.json({error},{status});
async function actor(){const u=await currentUser();if(!u)return null;const a=await db.user.findUnique({where:{id:u.id},select:{active:true,platformAdmin:true}});return a?.active&&a.platformAdmin?u:null;}
const minor=(v:unknown)=>{if(typeof v!=='string'&&! (typeof v==='number'&&Number.isFinite(v)))return null;const s=String(v).trim();if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))return null;const [whole,frac='']=s.split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'));return Number.isSafeInteger(n)&&n>0&&n<=2147483647?n:null;};
const reason=(v:unknown)=>typeof v==='string'?v.trim().slice(0,500):'';
const date=(v:unknown)=>{const d=new Date(String(v));return Number.isFinite(d.getTime())?d:null;};
const allowedCurrency=(v:unknown)=>typeof v==='string'&&/^[A-Z]{3}$/.test(v)?v:null;
export async function GET(){if(!await actor())return reply('Platform administrator required',403);
 const [companies,profiles,invoices,payments,subscriptions]=await Promise.all([
  db.company.findMany({select:{id:true,name:true,code:true},orderBy:{name:'asc'}}),
  db.nexoraBillingProfile.findMany(),
  db.nexoraInvoice.findMany({orderBy:{issuedAt:'desc'},take:500,include:{payments:{orderBy:{paidAt:'desc'}}}}),
  db.nexoraPayment.findMany({orderBy:{paidAt:'desc'},take:500}),
  db.platformSubscription.findMany({select:{id:true,companyId:true,planName:true,status:true,startsAt:true,endsAt:true},orderBy:{createdAt:'desc'},take:500})]);
 const now=Date.now();const enriched=invoices.map(i=>{const paid=i.payments.reduce((s,p)=>s+p.amountMinor,0);return {...i,paidMinor:paid,balanceMinor:i.status==='VOID'?0:i.amountMinor-paid,paymentStatus:i.status==='VOID'?'VOID':paid>=i.amountMinor?'PAID':i.dueAt.getTime()<now?'OVERDUE':paid>0?'PARTIAL':'UNPAID'};});
 const byCurrency:Record<string,{invoicedMinor:number;collectedMinor:number;outstandingMinor:number;overdueMinor:number}>={};
 for(const i of enriched){const m=byCurrency[i.currency]??={invoicedMinor:0,collectedMinor:0,outstandingMinor:0,overdueMinor:0};if(i.status!=='VOID'){m.invoicedMinor+=i.amountMinor;m.outstandingMinor+=i.balanceMinor;if(i.paymentStatus==='OVERDUE')m.overdueMinor+=i.balanceMinor;}}
 for(const p of payments){const m=byCurrency[p.currency]??={invoicedMinor:0,collectedMinor:0,outstandingMinor:0,overdueMinor:0};m.collectedMinor+=p.amountMinor;}
 return NextResponse.json({companies,profiles,invoices:enriched,payments,subscriptions,byCurrency},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){const u=await actor();if(!u)return reply('Platform administrator required',403);const b=await req.json().catch(()=>null);if(!b||typeof b!=='object')return reply('Invalid request');
 try{
 if(b.action==='profile'){
  const company=await db.company.findUnique({where:{id:String(b.companyId||'')}});if(!company)return reply('Company not found',404);
  const currency=allowedCurrency(b.currency);const terms=Number(b.paymentTermsDays);
  if(!currency||!Number.isInteger(terms)||terms<0||terms>365||!String(b.billingName||'').trim()||String(b.billingName).length>150)return reply('Invalid billing profile');
  const email=String(b.billingEmail||'').trim();if(email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return reply('Invalid billing email');
  const profile=await db.$transaction(async tx=>{const p=await tx.nexoraBillingProfile.upsert({where:{companyId:company.id},create:{companyId:company.id,billingName:String(b.billingName).trim(),billingEmail:email||null,billingAddress:reason(b.billingAddress)||null,currency,paymentTermsDays:terms},update:{billingName:String(b.billingName).trim(),billingEmail:email||null,billingAddress:reason(b.billingAddress)||null,currency,paymentTermsDays:terms}});await tx.auditLog.create({data:{actorId:u.id,companyId:company.id,action:'PLATFORM_BILLING_PROFILE_UPDATED',entity:'NexoraBillingProfile',entityId:p.id,detail:{currency,paymentTermsDays:terms}}});return p;});return NextResponse.json({profile});
 }
 if(b.action==='invoice'){
  const companyId=String(b.companyId||'');const company=await db.company.findUnique({where:{id:companyId}});if(!company)return reply('Company not found',404);
  const profile=await db.nexoraBillingProfile.findUnique({where:{companyId}});if(!profile)return reply('Set up company billing profile first');
  const amount=minor(b.amount);const dueAt=date(b.dueAt);const description=String(b.description||'').trim();const number=String(b.invoiceNumber||'').trim().toUpperCase();
  if(!amount||!dueAt||description.length<3||description.length>250||!/^NX-[A-Z0-9-]{5,45}$/.test(number))return reply('Invoice number (NX-...), description, amount and due date required');
  const subId=b.subscriptionId?String(b.subscriptionId):null;
  if(subId){const s=await db.platformSubscription.findFirst({where:{id:subId,companyId}});if(!s)return reply('Subscription does not belong to company');}
  const invoice=await db.$transaction(async tx=>{const i=await tx.nexoraInvoice.create({data:{companyId,invoiceNumber:number,description,currency:profile.currency,amountMinor:amount,dueAt,subscriptionId:subId,notes:reason(b.notes)||null}});await tx.auditLog.create({data:{actorId:u.id,companyId,action:'PLATFORM_INVOICE_ISSUED',entity:'NexoraInvoice',entityId:i.id,detail:{invoiceNumber:number,amountMinor:amount,currency:i.currency,subscriptionId:subId}}});return i;});return NextResponse.json({invoice},{status:201});
 }
 if(b.action==='payment'){
  const invoiceId=String(b.invoiceId||'');const amount=minor(b.amount);const method=String(b.method||'').trim().toUpperCase();const reference=String(b.reference||'').trim().toUpperCase();const paidAt=date(b.paidAt);if(!amount||!['BANK_TRANSFER','MOBILE_MONEY','CASH','OTHER'].includes(method)||reference.length<4||reference.length>100||!paidAt||paidAt.getTime()>Date.now()+86400000)return reply('Valid amount, method, reference and payment date required');
  // Serializable transaction prevents concurrent overpayments; unique method/reference prevents duplicate entry.
  const payment=await db.$transaction(async tx=>{const i=await tx.nexoraInvoice.findUnique({where:{id:invoiceId}});if(!i||i.status==='VOID')throw new Error('Invoice not found or void');const sum=await tx.nexoraPayment.aggregate({where:{invoiceId},_sum:{amountMinor:true}});if((sum._sum.amountMinor||0)+amount>i.amountMinor)throw new Error('Payment exceeds outstanding invoice balance');const p=await tx.nexoraPayment.create({data:{companyId:i.companyId,invoiceId,amountMinor:amount,currency:i.currency,method,reference,paidAt,notes:reason(b.notes)||null,recordedById:u.id}});await tx.auditLog.create({data:{actorId:u.id,companyId:i.companyId,action:'PLATFORM_PAYMENT_RECORDED',entity:'NexoraPayment',entityId:p.id,detail:{invoiceId,amountMinor:amount,method,reference}}});return p;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return NextResponse.json({payment},{status:201});
 }
 if(b.action==='void'){
  const id=String(b.invoiceId||'');const why=reason(b.reason);if(why.length<10)return reply('Reason must be at least 10 characters');
  const result=await db.$transaction(async tx=>{const i=await tx.nexoraInvoice.findUnique({where:{id},include:{_count:{select:{payments:true}}}});if(!i||i.status!=='ISSUED')throw new Error('Invoice not found or already void');if(i._count.payments)throw new Error('Invoices with payments cannot be voided');const updated=await tx.nexoraInvoice.update({where:{id},data:{status:'VOID'}});await tx.auditLog.create({data:{actorId:u.id,companyId:i.companyId,action:'PLATFORM_INVOICE_VOIDED',entity:'NexoraInvoice',entityId:id,detail:{reason:why}}});return updated;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return NextResponse.json({invoice:result});
 }
 return reply('Unknown action');
 }catch(e:any){if(e?.code==='P2002')return reply('Duplicate invoice number or payment reference',409);if(e?.code==='P2034')return reply('Concurrent update: please retry',409);return reply(e instanceof Error?e.message:'Unable to complete billing action',400);}
}
