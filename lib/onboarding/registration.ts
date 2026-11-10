// Registration validation, duplicate detection and plan lookup (shared by public and platform routes).
// Collects the same business details as Platform › Companies › Onboard Company.
import type {Prisma,PrismaClient} from '@prisma/client';
import {BILLING_CYCLES,COMPANY_TYPES,EMPLOYEE_BANDS,INDUSTRIES,MODULE_KEYS,OPEN_STATUSES} from './constants';
import {clean,cleanMultiline,companyNameKey,corporateDomain,normEmail,normPhone,normWebsite,phoneKey} from './security';

type Db=PrismaClient|Prisma.TransactionClient;

export type RegistrationInput={
 companyName:string;companyType:string;registrationNumber:string;taxIdentifier:string;industry:string;employeeBand:string|null;
 businessAddress:string;digitalAddress:string;city:string|null;companyEmail:string;companyPhone:string;website:string|null;
 contactName:string;contactPosition:string;contactPhone:string;contactEmail:string;
 adminName:string;adminEmail:string;adminPhone:string|null;adminJobTitle:string|null;
 planId:string;billingCycle:'MONTHLY'|'ANNUAL';notes:string|null;
};

/** Comparable form of registration numbers and Ghana Card/TIN: upper-case, letters and digits only. */
export const idKey=(v:string|null|undefined)=>v?v.toUpperCase().replace(/[^A-Z0-9]/g,'')||null:null;
const DIGITAL_ADDRESS=/^[A-Z]{2}-?\d{3,4}-?\d{4}$/i;
const fmtDigital=(v:string)=>{const m=v.toUpperCase().replace(/\s/g,'').match(/^([A-Z]{2})-?(\d{3,4})-?(\d{4})$/);return m?`${m[1]}-${m[2]}-${m[3]}`:v};

/** Validates a registration payload. Returns field-level messages written for the person filling the form. */
export function parseRegistration(b:any):{data?:RegistrationInput;errors:Record<string,string>}{
 const e:Record<string,string>={};
 const phone=(k:string,msg:string,required=true)=>{const v=normPhone(b?.[k]);if(v==='__invalid__'){e[k]='Use digits, spaces and an optional leading +.';return ''}if(!v&&required)e[k]=msg;return v};
 const companyName=clean(b?.companyName,120);
 if(companyName.length<2)e.companyName='Enter your company name.';else if(!/[A-Za-z0-9]/.test(companyName))e.companyName='Company name must contain letters or numbers.';
 const companyType=clean(b?.companyType,60);if(!(COMPANY_TYPES as readonly string[]).includes(companyType))e.companyType='Choose a company type.';
 const registrationNumber=clean(b?.registrationNumber,40).toUpperCase();if(!/^[A-Z0-9][A-Z0-9 /-]{2,39}$/.test(registrationNumber))e.registrationNumber='Enter your business registration number (for example CS123456789).';
 const taxIdentifier=clean(b?.taxIdentifier,30).toUpperCase();if(!/^[A-Z0-9][A-Z0-9-]{5,29}$/.test(taxIdentifier))e.taxIdentifier='Enter a Ghana Card number (GHA-XXXXXXXXX-X) or TIN.';
 const industry=clean(b?.industry,80);if(!(INDUSTRIES as readonly string[]).includes(industry))e.industry='Choose an industry.';
 const employeeBand=clean(b?.employeeBand,20)||null;if(employeeBand&&!(EMPLOYEE_BANDS as readonly string[]).includes(employeeBand))e.employeeBand='Choose a company size from the list.';
 const businessAddress=cleanMultiline(b?.businessAddress,500).replace(/\n+/g,', ');if(businessAddress.length<5)e.businessAddress='Enter your business address.';
 const digitalRaw=clean(b?.digitalAddress,20);if(!DIGITAL_ADDRESS.test(digitalRaw.replace(/\s/g,'')))e.digitalAddress='Enter a GhanaPost GPS address such as GA-123-4567.';
 const city=clean(b?.city,80)||null;
 const companyEmail=normEmail(b?.companyEmail);if(!companyEmail)e.companyEmail='Enter a valid company email address.';
 const companyPhone=phone('companyPhone','Enter the company phone number.');
 const websiteRaw=normWebsite(b?.website);if(websiteRaw==='__invalid__')e.website='Enter a website such as example.com.';
 const contactName=clean(b?.contactName,120);if(contactName.length<2)e.contactName='Enter the contact person’s full name.';
 const contactPosition=clean(b?.contactPosition,120);if(contactPosition.length<2)e.contactPosition='Enter the contact person’s position.';
 const contactPhone=phone('contactPhone','Enter the contact person’s phone number.');
 const contactEmail=normEmail(b?.contactEmail);if(!contactEmail)e.contactEmail='Enter a valid email address for the contact person.';
 const adminName=clean(b?.adminName,120);if(adminName.length<2)e.adminName='Enter the administrator’s full name.';
 const adminEmail=normEmail(b?.adminEmail);if(!adminEmail)e.adminEmail='Enter a valid email address for the administrator.';
 const adminPhone=phone('adminPhone','',false);
 const adminJobTitle=clean(b?.adminJobTitle,120)||null;
 const planId=clean(b?.planId,40);if(!planId)e.planId='Choose a plan.';
 const billingCycle=clean(b?.billingCycle,10).toUpperCase();if(!(BILLING_CYCLES as readonly string[]).includes(billingCycle))e.billingCycle='Choose monthly or annual billing.';
 const notes=cleanMultiline(b?.notes,1000)||null;
 if(Object.keys(e).length)return {errors:e};
 return {errors:{},data:{companyName,companyType,registrationNumber,taxIdentifier,industry,employeeBand,businessAddress,digitalAddress:fmtDigital(digitalRaw),city,companyEmail,companyPhone,website:websiteRaw||null,
  contactName,contactPosition,contactPhone,contactEmail,adminName,adminEmail,adminPhone:adminPhone||null,adminJobTitle,planId,billingCycle:billingCycle as 'MONTHLY'|'ANNUAL',notes}};
}

export type DuplicateFlag={kind:'BUSINESS_REGISTERED'|'OPEN_REGISTRATION_BUSINESS_ID'|'EXISTING_COMPANY_NAME'|'OPEN_REGISTRATION_NAME'|'COMPANY_DOMAIN'|'PHONE'|'COMPANY_EMAIL';severity:'blocking'|'high'|'medium';detail:string;ref?:string};
export type DuplicateResult={blockedReason:null|'ADMIN_EMAIL_HAS_ACCOUNT'|'ADMIN_EMAIL_OPEN_REGISTRATION';businessConflict:string|null;flags:DuplicateFlag[]};
type DupInput={companyName:string;companyEmail:string;companyPhone:string|null;adminEmail:string;registrationNumber?:string|null;taxIdentifier?:string|null};

/**
 * Duplicate prevention.
 * - Administrator email already has a Nexora login, or sits on another open registration → blockedReason (never created/approved).
 * - Registration number or Ghana Card/TIN already belongs to a company on Nexora → businessConflict (cannot be approved;
 *   mirrors the rule in Platform › Companies › Onboard Company).
 * - Same registration number/TIN as another open registration, same normalised name, corporate email domain, phone or
 *   company email → flags for the reviewer (high-severity flags need explicit acknowledgement to approve).
 */
export async function checkDuplicates(db:Db,i:DupInput,excludeId?:string):Promise<DuplicateResult>{
 const key=companyNameKey(i.companyName),domain=corporateDomain(i.companyEmail)||corporateDomain(i.adminEmail),phone=i.companyPhone?phoneKey(i.companyPhone):null;
 const reg=idKey(i.registrationNumber),tax=idKey(i.taxIdentifier);
 // "Open" = pending/approved; unverified self-registrations stop holding details once their link expires.
 const open:Prisma.CompanyRegistrationWhereInput[]=[{status:{in:OPEN_STATUSES}},{OR:[{status:{not:'PENDING_VERIFICATION'}},{emailTokenExpiresAt:{gt:new Date()}}]},...(excludeId?[{id:{not:excludeId}}]:[])];
 const [user,openAdmin]=await Promise.all([
  db.user.findUnique({where:{email:i.adminEmail},select:{id:true}}),
  db.companyRegistration.findFirst({where:{AND:[...open,{adminEmail:i.adminEmail}]},select:{id:true}}),
 ]);
 const blockedReason=user?'ADMIN_EMAIL_HAS_ACCOUNT':openAdmin?'ADMIN_EMAIL_OPEN_REGISTRATION':null;
 const flags:DuplicateFlag[]=[];let businessConflict:string|null=null;
 const companies=await db.company.findMany({select:{id:true,name:true,code:true,email:true,phone:true,registrationNumber:true,taxIdentifier:true}});
 for(const c of companies){
  if(reg&&idKey(c.registrationNumber)===reg||tax&&idKey(c.taxIdentifier)===tax){
   businessConflict=`${c.name} (${c.code}) is already registered on Nexora with the same ${reg&&idKey(c.registrationNumber)===reg?'business registration number':'Ghana Card / TIN'}.`;
   flags.push({kind:'BUSINESS_REGISTERED',severity:'blocking',detail:businessConflict,ref:c.id});continue;
  }
  if(key&&companyNameKey(c.name)===key)flags.push({kind:'EXISTING_COMPANY_NAME',severity:'high',detail:`Same name as existing company ${c.name} (${c.code})`,ref:c.id});
  else if(domain&&c.email&&corporateDomain(c.email)===domain)flags.push({kind:'COMPANY_DOMAIN',severity:'medium',detail:`Email domain ${domain} is used by existing company ${c.name} (${c.code})`,ref:c.id});
  if(phone&&c.phone&&phoneKey(c.phone)===phone)flags.push({kind:'PHONE',severity:'medium',detail:`Phone number matches existing company ${c.name} (${c.code})`,ref:c.id});
 }
 const others=await db.companyRegistration.findMany({where:{AND:[...open,{OR:[{companyNameKey:key},...(reg?[{registrationNumberKey:reg}]:[]),...(tax?[{taxIdentifierKey:tax}]:[]),...(domain?[{companyEmailDomain:domain}]:[]),...(phone?[{phoneKey:phone}]:[]),{companyEmail:i.companyEmail}]}]},select:{id:true,reference:true,companyName:true,companyNameKey:true,registrationNumberKey:true,taxIdentifierKey:true,companyEmailDomain:true,phoneKey:true,companyEmail:true},take:20});
 for(const r of others){
  if(reg&&r.registrationNumberKey===reg||tax&&r.taxIdentifierKey===tax)flags.push({kind:'OPEN_REGISTRATION_BUSINESS_ID',severity:'high',detail:`Registration ${r.reference} (${r.companyName}) uses the same registration number or Ghana Card / TIN`,ref:r.id});
  else if(r.companyNameKey===key)flags.push({kind:'OPEN_REGISTRATION_NAME',severity:'high',detail:`Another open registration uses the same name (${r.reference}: ${r.companyName})`,ref:r.id});
  else if(r.companyEmail===i.companyEmail)flags.push({kind:'COMPANY_EMAIL',severity:'medium',detail:`Company email also used by registration ${r.reference}`,ref:r.id});
  else if(domain&&r.companyEmailDomain===domain)flags.push({kind:'COMPANY_DOMAIN',severity:'medium',detail:`Same email domain as registration ${r.reference} (${r.companyName})`,ref:r.id});
  if(phone&&r.phoneKey===phone&&r.companyNameKey!==key)flags.push({kind:'PHONE',severity:'medium',detail:`Phone number matches registration ${r.reference}`,ref:r.id});
 }
 return {blockedReason,businessConflict,flags};
}

/** Active plan with a non-empty, valid module list — the only plans a company may register on. */
export async function loadPlan(db:Db,planId:string){
 const plan=await db.subscriptionPlan.findUnique({where:{id:planId}});
 if(!plan?.active)return null;
 const moduleKeys=Array.isArray(plan.moduleKeys)?[...new Set(plan.moduleKeys.filter((k):k is string=>typeof k==='string'&&(MODULE_KEYS as readonly string[]).includes(k)))]:[];
 if(!moduleKeys.length)return null;
 return {...plan,moduleKeys};
}

/** Fields persisted on CompanyRegistration from validated input. */
export function registrationColumns(d:RegistrationInput,planName:string){
 return {companyName:d.companyName,companyNameKey:companyNameKey(d.companyName),companyType:d.companyType,registrationNumber:d.registrationNumber,registrationNumberKey:idKey(d.registrationNumber),
  taxIdentifier:d.taxIdentifier,taxIdentifierKey:idKey(d.taxIdentifier),businessAddress:d.businessAddress,digitalAddress:d.digitalAddress,country:'Ghana',city:d.city,industry:d.industry,employeeBand:d.employeeBand,
  companyEmail:d.companyEmail,companyEmailDomain:corporateDomain(d.companyEmail)||corporateDomain(d.adminEmail),companyPhone:d.companyPhone,phoneKey:phoneKey(d.companyPhone),website:d.website,
  contactName:d.contactName,contactPosition:d.contactPosition,contactPhone:d.contactPhone,contactEmail:d.contactEmail,
  adminName:d.adminName,adminEmail:d.adminEmail,adminPhone:d.adminPhone,adminJobTitle:d.adminJobTitle,planId:d.planId,planName,billingCycle:d.billingCycle,notes:d.notes};
}

/** Subscription term from billing cycle. */
export function termEnd(start:Date,cycle:string){const d=new Date(start);if(cycle==='ANNUAL')d.setFullYear(d.getFullYear()+1);else d.setMonth(d.getMonth()+1);return d}
