// Phase 17 — shared constants for the public website and hybrid SaaS onboarding.
/** Every tenant module key Nexora provisions (must match the existing onboarding route). */
export const MODULE_KEYS=['employees','payroll','leave','training','recruitment','appraisals','onboarding','disciplinary','rewards','selfservice','access'] as const;
export const MODULE_LABELS:Record<string,string>={
 employees:'Employee Management',payroll:'Payroll & Benefits',leave:'Leave Management',training:'Training & Development',
 recruitment:'Recruitment',appraisals:'Performance Appraisal',onboarding:'Onboarding & Exit',disciplinary:'Disciplinary Management',
 rewards:'Rewards & Recognition',selfservice:'Employee Self-Service',access:'Access & Audit Controls'
};
/** Modules shown on the public website. Rewards & Recognition is not yet built, so it is never advertised. */
export const PUBLIC_MODULE_KEYS=MODULE_KEYS.filter(k=>k!=='rewards');

export const REGISTRATION_STATUS={
 PENDING_VERIFICATION:'PENDING_VERIFICATION',PENDING_REVIEW:'PENDING_REVIEW',APPROVED:'APPROVED',
 ACTIVE:'ACTIVE',REJECTED:'REJECTED',CANCELLED:'CANCELLED'
} as const;
/** Registrations in these states still "hold" the administrator email and company name. */
export const OPEN_STATUSES=['PENDING_VERIFICATION','PENDING_REVIEW','APPROVED'];
export const BILLING_CYCLES=['MONTHLY','ANNUAL'] as const;
/** Same list as Platform › Companies › Onboard Company. */
export const COMPANY_TYPES=['Limited Liability Company','Sole Proprietorship','Partnership','Public Limited Company','Nonprofit / NGO','Other'] as const;
export const EMPLOYEE_BANDS=['1–10','11–50','51–200','201–500','501–1,000','1,000+'] as const;
export const INDUSTRIES=['Agriculture','Construction & real estate','Education','Financial services','Healthcare','Hospitality & food service','Manufacturing','Media & creative','Mining & energy','Non-profit & NGO','Professional services','Public sector','Retail & wholesale','Technology','Transport & logistics','Other'] as const;
export const LEAD_KINDS=['DEMO','CONTACT'] as const;
export const LEAD_STATUSES=['NEW','CONTACTED','QUALIFIED','CLOSED'] as const;
export const CONTACT_TOPICS=['Sales','Support','Billing','Partnership','Other'] as const;

export const VERIFY_WINDOW_MS=48*60*60*1000;     // email verification link
export const INVITE_WINDOW_MS=72*60*60*1000;     // first-administrator invitation
