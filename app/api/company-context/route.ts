import {NextRequest,NextResponse} from 'next/server';
import {selectedCompany,chooseCompany} from '../../../lib/companyContext';
export async function GET(){
 const state=await selectedCompany();
 if(!state)return NextResponse.json({error:'Unauthorized or platform account'},{status:401});
 return NextResponse.json({activeCompanyId:state.selected?.companyId||null,companies:state.memberships.map(m=>({id:m.companyId,name:m.company.name,code:m.company.code,roles:m.roles.filter(r=>r.role.active).map(r=>r.role.name)})),mode:'PREVIEW_ONLY',warning:'Existing HRMS data and APIs are not yet tenant-isolated.'},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 if(typeof body?.companyId!=='string')return NextResponse.json({error:'Company required'},{status:400});
 const ok=await chooseCompany(body.companyId);
 if(!ok)return NextResponse.json({error:'You are not an active member of this company'},{status:403});
 return NextResponse.json({success:true,mode:'PREVIEW_ONLY'});
}
