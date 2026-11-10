import SiteFrame from '../_site/SiteFrame';
import LeadForm from '../_site/LeadForm';
import {Video,MessageSquareText,UserPlus} from 'lucide-react';
export const metadata={title:'Book a demo | Nexora HR Management System',description:'See Nexora with a member of our team.'};
export default function RequestDemo(){
 return <SiteFrame>
  <section className="pagehead dark"><div className="wrap"><h1>Book a demo</h1><p className="lede">A member of our team will walk you through Nexora using your own situation: your branches, your pay structure, your leave rules.</p></div></section>
  <section className="sec"><div className="wrap split">
   <aside><ul className="side-list" style={{marginTop:0}}>
    <li><span className="ico"><Video size={20} aria-hidden="true"/></span><p><b>A call or video meeting</b><span>At a time that suits you.</span></p></li>
    <li><span className="ico"><MessageSquareText size={20} aria-hidden="true"/></span><p><b>Bring your questions</b><span>Payroll, moving existing records across, who should see what.</span></p></li>
    <li><span className="ico"><UserPlus size={20} aria-hidden="true"/></span><p><b>We can set you up</b><span>After the demo our team can create your workspace with you. Prefer to start now? <a className="textlink" href="/register">Register online</a>.</span></p></li>
   </ul></aside>
   <div className="panel"><LeadForm kind="DEMO"/></div>
  </div></section>
 </SiteFrame>;
}
