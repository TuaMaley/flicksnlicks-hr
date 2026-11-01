import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

const defaults={
 platformName:'Nexora',supportEmail:'',supportPhone:'',defaultCountry:'Ghana',defaultTimezone:'Africa/Accra',
 defaultTrialDays:14,renewalReminderDays:30,gracePeriodDays:7,invoicePrefix:'NEX',paymentTermsDays:7,
 supportedCurrencies:'GHS,USD',notificationEmailEnabled:false,renewalEmailTemplate:'Your Nexora subscription expires on {{expiryDate}}.',
 invoiceEmailTemplate:'Your Nexora invoice {{invoiceNumber}} is ready.'
};
type Key=keyof typeof defaults;
const keys=Object.keys(defaults) as Key[];
async function authorize(){const user=await currentUser();if(!user)return {error:'Unauthorized',status:401} as const;
 const fresh=await db.user.findUnique({where:{id:user.id},select:{active:true,platformAdmin:true}});
 if(!fresh?.active||!fresh.platformAdmin)return {error:'Platform Super Administrator required',status:403} as const;
 return {user} as const;}
export async function GET(){const a=await authorize();if('error'in a)return NextResponse.json({error:a.error},{status:a.status});
 const rows=await db.platformSetting.findMany({where:{key:{in:keys}}});const settings:{[key:string]:unknown}={...defaults};for(const row of rows)settings[row.key]=row.value;
 return NextResponse.json({settings,updatedAt:rows.reduce<string|null>((last,row)=>!last||row.updatedAt.toISOString()>last?row.updatedAt.toISOString():last,null)},{headers:{'Cache-Control':'private, no-store'}});}
export async function PUT(req:NextRequest){const a=await authorize();if('error'in a)return NextResponse.json({error:a.error},{status:a.status});
 const body=await req.json().catch(()=>null);const values=body?.settings;const reason=typeof body?.reason==='string'?body.reason.trim():'';
 if(!values||typeof values!=='object'||Array.isArray(values)||reason.length<8||reason.length>500)return NextResponse.json({error:'Settings object and change reason (8–500 characters) required'},{status:400});
 const changed=Object.keys(values);if(!changed.length||changed.some(k=>!keys.includes(k as Key)))return NextResponse.json({error:'Unknown or empty settings update'},{status:400});
 const validated:Record<string,string|number|boolean>={};
 for(const key of changed){const v=values[key];const def=defaults[key as Key];if(typeof v!==typeof def)return NextResponse.json({error:`Invalid type for ${key}`},{status:400});
 if(typeof v==='string'){if(v.length>1000)return NextResponse.json({error:`${key} is too long`},{status:400});validated[key]=v.trim();}
 else if(typeof v==='number'){if(!Number.isInteger(v)||v<0||v>365)return NextResponse.json({error:`${key} must be an integer between 0 and 365`},{status:400});validated[key]=v;}
 else if(typeof v==='boolean')validated[key]=v;}
 if(validated.platformName!==undefined&&String(validated.platformName).length<2)return NextResponse.json({error:'Platform name must have at least 2 characters'},{status:400});
 if(validated.supportEmail&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(validated.supportEmail)))return NextResponse.json({error:'Invalid support email'},{status:400});
 if(validated.invoicePrefix&& !/^[A-Z0-9-]{2,15}$/.test(String(validated.invoicePrefix)))return NextResponse.json({error:'Invoice prefix must be 2–15 uppercase letters, digits or hyphens'},{status:400});
 if(validated.supportedCurrencies&& !/^[A-Z]{3}(,[A-Z]{3})*$/.test(String(validated.supportedCurrencies)))return NextResponse.json({error:'Use comma-separated ISO currency codes (example: GHS,USD)'},{status:400});
 if(validated.defaultTimezone){try{new Intl.DateTimeFormat('en-US',{timeZone:String(validated.defaultTimezone)})}catch{return NextResponse.json({error:'Invalid IANA timezone'},{status:400})}}
 const before=await db.platformSetting.findMany({where:{key:{in:changed}}});const prior=new Map(before.map(r=>[r.key,r.value]));
 await db.$transaction(async tx=>{for(const [key,value] of Object.entries(validated))await tx.platformSetting.upsert({where:{key},create:{key,value,updatedById:a.user.id},update:{value,updatedById:a.user.id}});
 await tx.auditLog.create({data:{actorId:a.user.id,action:'PLATFORM_SETTINGS_UPDATED',entity:'PlatformSetting',detail:{reason,changes:Object.fromEntries(Object.entries(validated).map(([key,value])=>[key,{previous:prior.has(key)?prior.get(key):defaults[key as Key],current:value}]))}}});});
 return NextResponse.json({success:true},{headers:{'Cache-Control':'private, no-store'}});
}
