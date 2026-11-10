import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
import {Landmark,Smartphone,ClipboardCheck,BadgeCheck,ArrowRight} from 'lucide-react';
export const metadata=pageMeta('About | Nexora HR Management System','Nexora is HR and payroll software for growing businesses, with statutory payroll rules built in, self-service for every employee and finance-grade controls.','/about');
export default function About(){
 return <SiteFrame active="about">
  <section className="pagehead dark has-art"><div className="wrap"><div><h1>HR software that understands how growing businesses work</h1><p className="lede">Nexora began inside a growing business that needed its people records, leave, appraisals and payroll in one dependable place — and could not find software that handled statutory payroll and multi-branch teams without workarounds.</p></div><img className="art" src="/art/about.svg" alt="" width={520} height={420}/></div></section>
  <section className="sec"><div className="wrap twocol">
   <div><h2>What we believe</h2><p className="lede" style={{fontSize:18}}>Good HR is mostly good records, kept honestly and shared with the right people.</p></div>
   <div className="values">
    <div><span className="ico"><Landmark size={20} aria-hidden="true"/></span><h3>Statutory rules, built in</h3><p>Payroll follows the rules employers must apply: income tax bands, tiered pension contributions and the statutory details employers are asked for. When the rules change, they’re updated in one place.</p></div>
    <div><span className="ico"><Smartphone size={20} aria-hidden="true"/></span><h3>Every employee included</h3><p>Staff get their own access on the web or the mobile app — payslips, leave and requests — so HR answers fewer of the same questions.</p></div>
    <div><span className="ico"><ClipboardCheck size={20} aria-hidden="true"/></span><h3>Controls finance will sign off</h3><p>Pay runs need a second approver. Sensitive changes are logged. Access is reviewed. That is how the product works, not an add-on.</p></div>
    <div><span className="ico"><BadgeCheck size={20} aria-hidden="true"/></span><h3>A person reviews every company</h3><p>We check each registration before creating a workspace. It keeps out fake accounts and gives every customer a named contact on our team.</p></div>
   </div>
  </div></section>
  <section className="sec" style={{paddingTop:0}}><div className="wrap"><div className="cta">
   <div><h2>See it for yourself</h2><p className="lede">A short demo, using your own questions.</p></div>
   <div className="opts"><a className="opt" href="/request-demo"><span><b>Book a demo</b><span>We walk you through Nexora</span></span><ArrowRight size={20} aria-hidden="true"/></a><a className="opt" href="/contact"><span><b>Contact the team</b><span>Pricing, data or moving from another system</span></span><ArrowRight size={20} aria-hidden="true"/></a></div>
  </div></div></section>
 </SiteFrame>;
}
