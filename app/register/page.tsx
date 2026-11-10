import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
import {publicPlans} from '../_site/plans';
import RegisterForm from './RegisterForm';
import {MailCheck,BadgeCheck,KeyRound,Building2} from 'lucide-react';
export const dynamic='force-dynamic';
export const metadata=pageMeta('Register your company | Nexora','Register your company for Nexora HR Management System.','/register');
export default async function Register({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const sp=await searchParams;const plans=await publicPlans();
 const plan=typeof sp.plan==='string'&&plans.some(p=>p.id===sp.plan)?sp.plan:'';
 const cycle=sp.cycle==='ANNUAL'?'ANNUAL':'MONTHLY';
 return <SiteFrame>
  <section className="pagehead dark"><div className="wrap"><h1>Register your company</h1><p className="lede">About ten minutes. Have your business registration number, Ghana Card or TIN and GhanaPost GPS address to hand. Nothing is charged today.</p></div></section>
  <section className="sec fog"><div className="wrap split">
   <aside>
    <img className="art aside-art" src="/art/onboarding.svg" alt="" width={480} height={220}/>
    <h2 style={{fontSize:26}}>What happens next</h2>
    <ul className="side-list">
     <li><span className="ico"><Building2 size={20} aria-hidden="true"/></span><p><b>You register</b><span>Your business details, contact person and plan.</span></p></li>
     <li><span className="ico"><MailCheck size={20} aria-hidden="true"/></span><p><b>You confirm your email</b><span>We send a link to your administrator’s address.</span></p></li>
     <li><span className="ico"><BadgeCheck size={20} aria-hidden="true"/></span><p><b>We review</b><span>Our team checks the details and creates your workspace.</span></p></li>
     <li><span className="ico"><KeyRound size={20} aria-hidden="true"/></span><p><b>You activate</b><span>Your administrator sets a password and you’re live. Your subscription starts that day.</span></p></li>
    </ul>
    <p style={{marginTop:28,color:'var(--muted)'}}>Rather we set it up with you? <a className="textlink" href="/request-demo">Book a demo</a></p>
   </aside>
   <div className="panel">{plans.length?<RegisterForm plans={plans} initialPlan={plan} initialCycle={cycle}/>:<div className="alert">Online registration is not available right now. <a href="/request-demo">Book a demo</a> and our team will set up your workspace.</div>}</div>
  </div></section>
 </SiteFrame>;
}
