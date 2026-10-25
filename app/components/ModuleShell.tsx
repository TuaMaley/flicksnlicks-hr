'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {LayoutDashboard,Users,Wallet,CalendarDays,GraduationCap,UserPlus,ClipboardCheck,LogOut,ShieldAlert,Award,UserRound,ShieldCheck,BarChart3,Settings,Menu,X} from 'lucide-react';

const items=[
 {label:'Dashboard',href:'/',Icon:LayoutDashboard},
 {label:'Employee Management',href:'/employees',permission:'employees.view',Icon:Users},
 {label:'Payroll & Benefits',href:'/',permission:'payroll.view',Icon:Wallet},
 {label:'Leave Management',href:'/leave',permission:'leave.view',Icon:CalendarDays},
 {label:'Training & Development',href:'/',permission:'training.view',Icon:GraduationCap},
 {label:'Recruitment',href:'/',permission:'recruitment.view',Icon:UserPlus},
 {label:'Performance Appraisal',href:'/appraisals',permission:'appraisals.view',Icon:ClipboardCheck},
 {label:'Onboarding & Exit',href:'/',permission:'onboarding.view',Icon:LogOut},
 {label:'Disciplinary Management',href:'/',permission:'disciplinary.view',Icon:ShieldAlert},
 {label:'Rewards & Recognition',href:'/',permission:'rewards.view',Icon:Award},
 {label:'Employee Self-Service',href:'/',permission:'selfservice.view',Icon:UserRound},
 {label:'Access & Audit Controls',href:'/access',permission:'access.view',Icon:ShieldCheck},
];
const hiddenPaths=['/login'];
export default function ModuleShell({children}:{children:React.ReactNode}){
 const pathname=usePathname()||'/';
 const [permissions,setPermissions]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 const [open,setOpen]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(active){setPermissions(d?.permissions||[]);setReady(Boolean(d))}}).catch(()=>{if(active)setReady(false)});return()=>{active=false}},[pathname]);
 useEffect(()=>setOpen(false),[pathname]);
 // Dashboard already owns its full sidebar. Do not render two sidebars there.
 if(pathname==='/'||hiddenPaths.some(p=>pathname===p||pathname.startsWith(p+'/'))||pathname.startsWith('/api/'))return <>{children}</>;
 const activeHref=pathname.startsWith('/appraisals')||pathname.startsWith('/pips')?'/appraisals':pathname.startsWith('/employees')?'/employees':pathname.startsWith('/leave')?'/leave':pathname.startsWith('/access')?'/access':pathname.startsWith('/settings')?'/settings':pathname;
 return <div className="shell persistentShell">
 <aside className={'sidebar persistentSidebar '+(open?'open':'')} aria-label="Main navigation">
 <div className="brand"><div className="brandLogo"><Image src="/logo.png" alt="Flicks & Licks" fill sizes="48px" style={{objectFit:'cover'}}/></div><div><strong>Flicks & Licks</strong><small>HR MANAGEMENT</small></div></div>
 {items.slice(0,1).map(({label,href,Icon})=><Link key={label} className={'nav '+(activeHref===href?'selected':'')} href={href} aria-current={activeHref===href?'page':undefined}><Icon size={19}/><span>{label}</span></Link>)}
 <div className="navSection">MAIN MODULES</div>
 {ready&&items.slice(1).filter(i=>!i.permission||permissions.includes(i.permission)).map(({label,href,Icon})=><Link key={label} className={'nav '+(href!=='/'&&activeHref===href?'selected':'')} href={href} aria-current={href!=='/'&&activeHref===href?'page':undefined}><Icon size={19}/><span>{label}</span></Link>)}
 <div className="navSection">REPORTS</div>
 {ready&&permissions.includes('access.audit.view')&&<Link className="nav" href="/access"><BarChart3 size={19}/>Reports & Analytics</Link>}
 <div className="navSection">SYSTEM</div>
 {ready&&permissions.includes('access.roles.manage')&&<Link className={'nav '+(activeHref==='/settings'?'selected':'')} href="/settings"><Settings size={19}/>Settings</Link>}
 <button type="button" className="nav" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login'}}><LogOut size={19}/>Sign out</button>
 <div className="sideFooter">Good Food<br/><b>Great People</b><i/></div>
 </aside>
 <button type="button" className="persistentMobileToggle" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>} Menu</button>
 {open&&<button type="button" className="persistentBackdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
 <div className="persistentContent">{children}</div>
 </div>;
}
