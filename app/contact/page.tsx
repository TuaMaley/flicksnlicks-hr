import SiteFrame from '../_site/SiteFrame';
import LeadForm from '../_site/LeadForm';
import {Mail,KeyRound,Video} from 'lucide-react';
export const metadata={title:'Contact | Nexora HR Management System',description:'Get in touch with the Nexora team.'};
export default function Contact(){
 const email=process.env.NEXT_PUBLIC_NEXORA_CONTACT_EMAIL||'';
 return <SiteFrame active="contact">
  <section className="pagehead dark"><div className="wrap"><h1>Contact us</h1><p className="lede">Questions about plans, billing, your data or an existing account. We reply by email.</p></div></section>
  <section className="sec"><div className="wrap split">
   <aside><ul className="side-list" style={{marginTop:0}}>
    {email&&<li><span className="ico"><Mail size={20} aria-hidden="true"/></span><p><b>Email</b><span><a href={`mailto:${email}`}>{email}</a></span></p></li>}
    <li><span className="ico"><KeyRound size={20} aria-hidden="true"/></span><p><b>Already a customer?</b><span>For account changes, contact your company’s Nexora administrator. <a className="textlink" href="/forgot-password">Forgotten your password?</a></span></p></li>
    <li><span className="ico"><Video size={20} aria-hidden="true"/></span><p><b>Want a walkthrough?</b><span><a className="textlink" href="/request-demo">Book a demo</a> instead.</span></p></li>
   </ul></aside>
   <div className="panel"><LeadForm kind="CONTACT"/></div>
  </div></section>
 </SiteFrame>;
}
