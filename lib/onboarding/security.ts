import {createHash,randomBytes} from 'node:crypto';
import type {NextRequest} from 'next/server';

/** Salted hash of the caller IP: lets us throttle and correlate abuse without storing raw IPs. */
export function clientIpHash(req:NextRequest){
 const fwd=req.headers.get('x-forwarded-for')||'';
 const ip=(fwd.split(',')[0]||req.headers.get('x-real-ip')||'unknown').trim();
 const salt=process.env.AUTH_SECRET||'nexora';
 return createHash('sha256').update(salt+':ip:'+ip).digest('hex').slice(0,40);
}
export const newToken=()=>randomBytes(32).toString('hex');
export const digestToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const isToken=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

const REF_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newReference(){const b=randomBytes(8);let s='';for(const x of b)s+=REF_ALPHABET[x%REF_ALPHABET.length];return `NXR-${s.slice(0,4)}-${s.slice(4)}`}

/** Trim, collapse whitespace, strip control characters and cap length. Returns '' for non-strings. */
export function clean(v:unknown,max=200){if(typeof v!=='string')return '';return v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
/** Like clean() but keeps line breaks (for free-text messages). */
export function cleanMultiline(v:unknown,max=2000){if(typeof v!=='string')return '';return v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,max)}
export const EMAIL_RE=/^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export function normEmail(v:unknown){const e=clean(v,254).toLowerCase();return EMAIL_RE.test(e)?e:''}
export function emailDomain(email:string){return email.split('@')[1]?.toLowerCase()||''}
const FREE_DOMAINS=new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','ymail.com','hotmail.com','outlook.com','live.com','msn.com','icloud.com','me.com','aol.com','proton.me','protonmail.com','gmx.com','mail.com','zoho.com','yandex.com']);
/** Company email domain worth comparing for duplicates; free webmail domains are ignored. */
export function corporateDomain(email:string){const d=emailDomain(email);return d&&!FREE_DOMAINS.has(d)?d:null}
export function normPhone(v:unknown){const p=clean(v,40);if(!p)return '';return /^\+?[0-9 ()-]{7,20}$/.test(p)?p:'__invalid__'}
/** Comparable phone key: digits only, Ghana local 0XXXXXXXXX folded to 233XXXXXXXXX. */
export function phoneKey(p:string){let d=p.replace(/\D/g,'');if(d.length===10&&d.startsWith('0'))d='233'+d.slice(1);return d||null}
export function normWebsite(v:unknown){const w=clean(v,200);if(!w)return '';try{const u=new URL(/^https?:\/\//i.test(w)?w:'https://'+w);if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.'))return '__invalid__';return u.origin+(u.pathname==='/'?'':u.pathname)}catch{return '__invalid__'}}

const SUFFIXES=/\b(limited|ltd|plc|inc|incorporated|llc|llp|company|co|corp|corporation|group|holdings|enterprise|enterprises|the)\b/g;
/** Normalised company name used to detect duplicates ("Acme Ltd." ≡ "ACME Limited"). */
export function companyNameKey(name:string){return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9 ]+/g,' ').replace(SUFFIXES,' ').replace(/\s+/g,' ').trim()}

/** Suggest a tenant code (matches the existing ^[A-Z0-9_-]{2,30}$ rule). */
export function suggestCompanyCode(name:string){const words=companyNameKey(name).toUpperCase().split(' ').filter(Boolean);let base=words.length>1?words.map(w=>w[0]).join('').slice(0,6):(words[0]||'CO').slice(0,8);if(base.length<3)base=(words.join('').slice(0,6)||'COMPANY');return base.replace(/[^A-Z0-9]/g,'')||'COMPANY'}

/** Bot speed-bump: a hidden honeypot field and a minimum time on the form. */
export function looksAutomated(body:any){
 if(typeof body?.website_url==='string'&&body.website_url.trim()!=='')return true; // honeypot (real field is "website")
 const started=Number(body?.startedAt);
 if(!Number.isFinite(started))return true;
 const elapsed=Date.now()-started;
 return elapsed<2500||elapsed>24*60*60*1000;
}
