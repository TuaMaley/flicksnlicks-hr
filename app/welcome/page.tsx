// Public home page. Served at "/" for signed-out visitors (middleware rewrite) and at /welcome.
import SiteFrame from '../_site/SiteFrame';
import ModuleExplorer from '../_site/ModuleExplorer';
import Phone from '../_site/Phone';
import VideoFeature from '../_site/VideoFeature';
import {siteVideo} from '../_site/video';
import {OCT_2026_BANDS,computeGhanaPayroll} from '../../lib/ghana-payroll';
import {ArrowRight,BadgeCheck,Building2,CalendarCheck,ClipboardCheck,FileCheck2,IdCard,Landmark,LayoutDashboard,Lock,MapPin,ScrollText,ShieldCheck,Smartphone,Users,UsersRound,Wallet,Check,CheckCircle2} from 'lucide-react';

export const metadata={title:'Nexora | HR and payroll software for Ghanaian businesses',description:'Run people, payroll and performance in one place. PAYE and SSNIT calculated for you, leave and appraisals tracked, and payslips every employee can open on their phone.'};

const money=(n:number)=>n.toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2});

export const dynamic='force-dynamic';

export default function Welcome(){
 const video=siteVideo();
 // A real calculation from the same engine Nexora payroll uses.
 const calc=(basic:number,allowances:number)=>computeGhanaPayroll({basic,allowances,otherDeductions:0,overtimeDays:0,overtimeRate:0,unpaidDays:0,workDaysPerMonth:22,tier3Employee:0,employeeRate:.055,employerRate:.13,tier1Rate:.135,tier2Rate:.05,minimumInsurable:0,maximumInsurable:1_000_000,taxBands:OCT_2026_BANDS});
 const pay=calc(6500,1200),kwame=calc(4600,800),efua=calc(8500,1300);
 return <SiteFrame>
  <section className="hero dark"><div className="wrap">
   <div className="hero-copy">
    <h1>HR and payroll, built for how Ghana works.</h1>
    <p className="lede">Nexora brings employee records, leave, appraisals and payroll into one place. PAYE and SSNIT are calculated for every pay run, and every employee can open their own payslip on their phone.</p>
    <div className="actions"><a className="btn btn-red" href="/register">Register your company <ArrowRight size={18} aria-hidden="true"/></a><a className="btn btn-line" href="/request-demo">Book a demo</a></div>
    <p className="assure"><span><BadgeCheck size={16} aria-hidden="true"/>Every new company is reviewed by our team</span><span><Lock size={16} aria-hidden="true"/>Your data is kept separate from every other company</span></p>
   </div>

   <div className="stage">
    <div className="win" aria-hidden="true">
     <div className="win-bar"><i/><i/><i/><span>app.nexora-hrms.com/payroll</span></div>
     <div className="win-body">
      <div className="win-side"><img src="/nexora-wordmark-light.png" alt=""/>
       <b><LayoutDashboard size={15}/>Dashboard</b><b><Users size={15}/>Employees</b><b><CalendarCheck size={15}/>Leave</b><b className="on"><Wallet size={15}/>Payroll</b><b><ClipboardCheck size={15}/>Appraisals</b><b><ShieldCheck size={15}/>Access</b>
      </div>
      <div className="win-main">
       <h4>October 2026 pay run</h4><p className="sub">Head Office and Kumasi branch · monthly</p>
       <div className="wkpis">
        <div className="wkpi"><small>Employees</small><b className="num">48</b></div>
        <div className="wkpi"><small>Gross pay</small><b className="num">GH₵ 312,480</b></div>
        <div className="wkpi"><small>PAYE</small><b className="num">GH₵ 51,906</b></div>
        <div className="wkpi"><small>SSNIT (employee)</small><b className="num">GH₵ 14,712</b></div>
       </div>
       <div className="runrow th"><span>Employee</span><span className="r">Gross</span><span className="r">PAYE</span><span className="r">Net</span></div>
       <div className="runrow"><span className="who"><span className="av">AM</span>Ama Mensah</span><span className="r num">{money(pay.gross)}</span><span className="r num">{money(pay.incomeTax)}</span><span className="r num">{money(pay.net)}</span></div>
       <div className="runrow"><span className="who"><span className="av">KO</span>Kwame Owusu</span><span className="r num">{money(kwame.gross)}</span><span className="r num">{money(kwame.incomeTax)}</span><span className="r num">{money(kwame.net)}</span></div>
       <div className="runrow"><span className="who"><span className="av">EA</span>Efua Asante</span><span className="r num">{money(efua.gross)}</span><span className="r num">{money(efua.incomeTax)}</span><span className="r num">{money(efua.net)}</span></div>
       <div className="approve"><div><b>Ready for approval</b><br/><span>Prepared by Payroll Officer · needs a second approver</span></div><em>Approve run</em></div>
      </div>
     </div>
    </div>
    <Phone net={money(pay.net)}/>
    <figure className="slipcard" aria-label="Sample payslip calculated by Nexora" style={{margin:0}}>
     <header><b>Payslip · Ama Mensah</b><span>October 2026</span></header>
     <table><tbody>
      <tr><td>Basic salary</td><td>{money(pay.basic)}</td></tr>
      <tr><td>Allowances</td><td>{money(pay.allowances)}</td></tr>
      <tr className="ded"><td>SSNIT 5.5%</td><td>−{money(pay.employeeSSNIT)}</td></tr>
      <tr className="ded"><td>PAYE</td><td>−{money(pay.incomeTax)}</td></tr>
      <tr className="tot"><td>Net pay (GH₵)</td><td>{money(pay.net)}</td></tr>
     </tbody></table>
     <footer>Calculated with Nexora’s Ghana PAYE engine</footer>
    </figure>
   </div>
  </div></section>

  <section className="strip" aria-label="Built for Ghana"><div className="wrap">
   <p className="lbl">Built for Ghanaian employers</p>
   <div className="it"><span className="ico"><Landmark size={20} aria-hidden="true"/></span><p><b>PAYE</b><span>GRA tax bands built in</span></p></div>
   <div className="it"><span className="ico"><ShieldCheck size={20} aria-hidden="true"/></span><p><b>SSNIT</b><span>Tier 1, 2 and 3 contributions</span></p></div>
   <div className="it"><span className="ico"><IdCard size={20} aria-hidden="true"/></span><p><b>Ghana Card</b><span>Recorded on employee profiles</span></p></div>
   <div className="it"><span className="ico"><MapPin size={20} aria-hidden="true"/></span><p><b>GhanaPost GPS</b><span>Digital addresses for your business</span></p></div>
  </div></section>

  {video&&<section className="sec video-sec" aria-labelledby="tour-h"><div className="wrap">
   <div><h2 id="tour-h">See Nexora in action</h2><p className="lede">A walkthrough of employee records, leave, payroll and self-service — the way your team will use them every day.</p>
    <div className="actions"><a className="btn btn-ink" href="/request-demo">Book a live demo</a></div></div>
   <VideoFeature video={video} label="Product tour · 3 min"/>
  </div></section>}

  <section className="sec fog"><div className="wrap">
   <div className="head"><h2>What payday looks like in Nexora</h2><p>Payroll runs on the same employee records your HR team already keeps, so nothing is typed twice.</p></div>
   <ol className="flow">
    <li><span className="ico"><CalendarCheck size={20} aria-hidden="true"/></span><h3>Confirm attendance</h3><p>Record days worked, unpaid days and overtime for the period.</p></li>
    <li><span className="ico"><ClipboardCheck size={20} aria-hidden="true"/></span><h3>Calculate and approve</h3><p>Nexora works out gross pay, SSNIT tiers and PAYE. A second person approves the run before anything is paid.</p></li>
    <li><span className="ico"><FileCheck2 size={20} aria-hidden="true"/></span><h3>Pay and publish</h3><p>Record or import payments from Excel and release payslips each employee can download as a PDF.</p></li>
   </ol>
  </div></section>

  <section className="sec"><div className="wrap">
   <div className="head"><h2>Everything HR needs, in three parts</h2><p>Turn on the modules your plan includes. Everyone sees only what their role allows.</p></div>
   <ModuleExplorer/>
   <div className="actions"><a className="textlink" href="/features">See every feature <ArrowRight size={16} aria-hidden="true"/></a></div>
  </div></section>

  <section className="sec dark"><div className="wrap ess">
   <div>
    <h2>Every employee included, on their own phone</h2>
    <p className="lede">The Nexora Employee app and web portal give staff their own access, so HR spends less time answering the same questions.</p>
    <ul className="ticks">
     <li><CheckCircle2 size={20} aria-hidden="true"/><span><b>Payslips whenever they need them</b>Every month’s payslip, downloadable as a PDF.</span></li>
     <li><CheckCircle2 size={20} aria-hidden="true"/><span><b>Leave without the paperwork</b>Check balances, request time off and follow the approval.</span></li>
     <li><CheckCircle2 size={20} aria-hidden="true"/><span><b>Letters and requests</b>Request employment letters and track HR requests.</span></li>
     <li><CheckCircle2 size={20} aria-hidden="true"/><span><b>Internal vacancies</b>See open roles, apply or refer someone.</span></li>
    </ul>
    <div className="actions"><a className="btn btn-line" href="https://employee.nexora-hrms.com"><Smartphone size={18} aria-hidden="true"/>Open the employee portal</a></div>
   </div>
   <Phone net={money(pay.net)}/>
  </div></section>

  <section className="sec dark" style={{paddingTop:0}}><div className="wrap">
   <div className="head"><h2>Your people data stays yours</h2><p>Payroll and personnel files are the most sensitive records a business keeps. Nexora is built to protect them.</p></div>
   <div className="secgrid">
    <div><span className="ico"><Building2 size={20} aria-hidden="true"/></span><h3>Separate workspaces</h3><p>Each company’s data is kept apart. Users only ever see the companies they belong to.</p></div>
    <div><span className="ico"><UsersRound size={20} aria-hidden="true"/></span><h3>Role-based access</h3><p>Decide who can view salaries, approve payroll or manage employees, down to branch and department.</p></div>
    <div><span className="ico"><ScrollText size={20} aria-hidden="true"/></span><h3>Full audit trail</h3><p>Sign-ins, approvals and changes to sensitive records are logged with who did what and when.</p></div>
    <div><span className="ico"><Lock size={20} aria-hidden="true"/></span><h3>Session protection</h3><p>Idle sessions sign out automatically, and access can be reviewed on a schedule.</p></div>
   </div>
  </div></section>

  <section className="sec"><div className="wrap">
   <div className="head"><h2>From sign-up to live in four steps</h2><p>Register online yourself, or let our team set you up. Either way, a person checks every new company before its workspace goes live.</p></div>
   <ol className="journey">
    <li><span className="dot">1</span><div><h3>Register</h3><p>Tell us about your business, who will administer Nexora and which plan you want.</p></div></li>
    <li><span className="dot">2</span><div><h3>Confirm your email</h3><p>Click the link we send so we know the address is yours.</p></div></li>
    <li><span className="dot">3</span><div><h3>We review</h3><p>Our team checks your details and creates your company workspace.</p></div></li>
    <li><span className="dot">4</span><div><h3>Activate</h3><p>Your administrator sets a password and you are live. Your subscription starts that day.</p></div></li>
   </ol>
  </div></section>

  <section className="sec" style={{paddingTop:0}}><div className="wrap">
   <div className="cta">
    <div><h2>Ready when you are</h2><p className="lede">Start online in about ten minutes, or book a walkthrough with our team first.</p></div>
    <div className="opts">
     <a className="opt" href="/register"><span><b>Register your company</b><span>Choose a plan and get reviewed</span></span><ArrowRight size={20} aria-hidden="true"/></a>
     <a className="opt" href="/request-demo"><span><b>Book a demo</b><span>We set you up together</span></span><ArrowRight size={20} aria-hidden="true"/></a>
     <a className="opt" href="/pricing"><span><b>Compare plans</b><span>Monthly or annual billing</span></span><Check size={20} aria-hidden="true"/></a>
    </div>
   </div>
  </div></section>
 </SiteFrame>;
}
