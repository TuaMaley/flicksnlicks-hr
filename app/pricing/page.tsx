import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
import {publicPlans} from '../_site/plans';
import PricingTable from './PricingTable';
import {ArrowRight} from 'lucide-react';
export const dynamic='force-dynamic';
export const metadata=pageMeta('Pricing | Nexora HR Management System','Plans for every stage of your business — Starter to Enterprise, billed monthly or annually.','/pricing');
const FAQ:[string,string][]=[
 ['When does my subscription start?','On the day your workspace is activated — when your administrator accepts their invitation and sets a password. Nothing is charged while your registration is being reviewed.'],
 ['How do I pay?','The Nexora team issues an invoice for your plan. Pay by bank transfer or mobile money using the details on the invoice.'],
 ['Can I change plan later?','Yes. Contact us and we will move you to another plan; your employee records and history stay as they are.'],
 ['Why is every registration reviewed?','A person on our team checks each new company before its workspace is created. It keeps the platform free of fake accounts and gives every customer a named contact.'],
 ['Can you set us up instead?','Yes. Book a demo and our team will create your workspace with you and help you bring employee records across.'],
 ['Do employees need their own licence?','Plans are priced per company. Employees use self-service on the web or the Nexora Employee app as part of your plan when it includes Employee Self-Service.'],
];
export default async function Pricing(){
 const plans=await publicPlans();
 return <SiteFrame active="pricing">
  <section className="pagehead dark"><div className="wrap"><h1>Simple plans for every stage of your business</h1><p className="lede">Pick the modules you need today and change plan as you grow. We quote every plan for your organisation — monthly or annual billing.</p></div></section>
  <section className="sec"><div className="wrap">
   {plans.length?<PricingTable plans={plans}/>:<div className="alert">Plans are being updated. <a href="/request-demo">Book a demo</a> and we will quote for your organisation.</div>}
   <p className="note">Your subscription starts on the day your workspace is activated. Invoices are issued by the Nexora team; pay by bank transfer or mobile money as stated on the invoice.</p>
  </div></section>
  <section className="sec fog"><div className="wrap twocol">
   <div><h2>Questions about plans</h2><p className="lede" style={{fontSize:18}}>Something else? <a className="textlink" href="/contact">Contact us <ArrowRight size={16} aria-hidden="true"/></a></p></div>
   <div className="faq">{FAQ.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </div></section>
 </SiteFrame>;
}
