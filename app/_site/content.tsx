// Module catalogue shown on the public site (home explorer and Features page). Grounded in what Nexora ships today.
import {Users,CalendarDays,UserPlus,Smartphone,Award,Target,Gavel,Wallet,Briefcase,GraduationCap} from 'lucide-react';
export type SiteModule={key:string;name:string;what:string;Icon:typeof Users;items:string[]};
export type SiteGroup={title:string;sub:string;mods:SiteModule[]};
export const GROUPS:SiteGroup[]=[
 {title:'People',sub:'The records and everyday requests every HR team handles.',mods:[
  {key:'employees',name:'Employee Management',Icon:Users,what:'One accurate record for every employee, across every branch.',items:['Employee profiles and photos','Branches, departments and positions','Reporting managers','Automatic employee numbers','Bulk import from Excel','Ghana Card and statutory details']},
  {key:'leave',name:'Leave Management',Icon:CalendarDays,what:'Leave rules your staff understand and managers approve in a click.',items:['Leave policies and entitlements','Live leave balances','Requests and approvals','Team leave calendar','Eligibility checks per policy','Leave history']},
  {key:'onboarding',name:'Onboarding & Exit',Icon:UserPlus,what:'Nobody forgets a step when people join or leave.',items:['Onboarding task lists','Exit and clearance tasks','Final sign-off before exit','Onboarding and exit analytics']},
  {key:'selfservice',name:'Employee Self-Service',Icon:Smartphone,what:'Employees help themselves on the web or the Nexora mobile app.',items:['Payslips as PDF','Leave requests and balances','Profile and photo','Internal job vacancies and referrals','HR requests with tracking','Employment verification letters']},
 ]},
 {title:'Performance',sub:'Fair, documented reviews and consistent handling of conduct.',mods:[
  {key:'appraisals',name:'Performance Appraisal',Icon:Award,what:'Run review cycles the same way across the company.',items:['Reusable appraisal templates','KPI-based scoring','Review cycles and assignments','Appraisal history','Reports and analytics']},
  {key:'pips',name:'Improvement Plans',Icon:Target,what:'Support under-performing staff with a clear, recorded plan.',items:['Goals and timelines','Scheduled check-ins','Outcome recording']},
  {key:'disciplinary',name:'Disciplinary Management',Icon:Gavel,what:'A consistent, auditable process from complaint to outcome.',items:['Cases linked to your policy','Hearings and notices','Letters generated from the case','Appeals and approvals','Disciplinary analytics']},
 ]},
 {title:'Growth',sub:'Paying people correctly, hiring well and building skills.',mods:[
  {key:'payroll',name:'Payroll & Benefits',Icon:Wallet,what:'Ghana payroll with the checks a finance team expects.',items:['PAYE with configurable GRA bands','SSNIT Tier 1, 2 and 3','Allowances and adjustments','Attendance-based pay and overtime','Maker-checker approval','Payments imported from Excel','Payslips and payroll reports']},
  {key:'recruitment',name:'Recruitment',Icon:Briefcase,what:'From an approved headcount request to a signed offer.',items:['Requisitions with approvals','Vacancies and applications','Interviews and assessments','Offers','Recruitment analytics']},
  {key:'training',name:'Training & Development',Icon:GraduationCap,what:'Plan training, see who attended and whether it helped.',items:['Training programmes','Enrolment','Attendance sessions','Evaluation questionnaires','Training analytics']},
 ]},
];
