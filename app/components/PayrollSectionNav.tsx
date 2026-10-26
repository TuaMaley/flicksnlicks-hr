'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import './PayrollSectionNav.css';

const sections = [
  {label:'Overview',href:'/payroll',enabled:true},
  {label:'Compensation',href:'/payroll/compensation',enabled:true},
  {label:'Attendance & Overtime',href:'/payroll/attendance',enabled:true},
  {label:'Process Payroll',href:'/payroll/process',enabled:true},
  {label:'Approvals',href:'/payroll/approvals',enabled:true},
  {label:'Payslips',href:'/payroll/payslips',enabled:true},
  {label:'Payments',href:'/payroll/payments',enabled:true},
  {label:'Reports',href:'/payroll/reports',enabled:true},
];
export default function PayrollSectionNav(){
 const pathname=usePathname();
 return <nav className="payrollSectionNav" aria-label="Payroll and Benefits sections">
 {sections.map(s=>{
  const active=pathname===s.href || (s.href!=='/payroll'&&pathname.startsWith(s.href+'/'));
  return s.enabled
   ? <Link key={s.href} href={s.href} className={active?'payrollSectionActive':''} aria-current={active?'page':undefined}>{s.label}</Link>
   : <span key={s.href} className="payrollSectionUpcoming" title="Coming in a future payroll phase" aria-disabled="true">{s.label}</span>;
 })}
 </nav>;
}
