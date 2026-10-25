'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export default function PerformanceSectionNav(){
 const path=usePathname();
 const [permissions,setPermissions]=useState<string[]>([]);
 const [roles,setRoles]=useState<string[]>([]);
 useEffect(()=>{let active=true;fetch('/api/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(active&&d){setPermissions(d.permissions||[]);setRoles(d.roles||[])}}).catch(()=>{});return()=>{active=false}},[]);
 const analytics=permissions.includes('appraisals.analytics.view')||roles.includes('HR Manager');
 const templates=roles.includes('HR Manager')||roles.includes('Administrator');
 const links=[['/appraisals','▤ Performance Reviews'],...(templates?[['/appraisals?tab=templates','▧ Appraisal Templates']]:[]),['/appraisals/cycles','▦ Appraisal Cycles'],...(analytics?[['/appraisals/analytics','◫ Performance Analytics']]:[]),['/appraisals/history','◷ Employee History'],['/pips','◇ Improvement Plans'],...(templates||permissions.includes('appraisals.reports.view')?[['/appraisals/reports','▣ Reports & Export']]:[])];
 return <nav className="pt-main-nav" aria-label="Performance appraisal sections">{links.map(([href,label])=><Link key={href} href={href} className={path===href?'pt-nav-active':''}>{label}</Link>)}</nav>;
}
