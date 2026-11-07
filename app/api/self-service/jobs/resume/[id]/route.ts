import {access} from '../../../../../../lib/auth';
import {db} from '../../../../../../lib/db';
import {NextResponse} from 'next/server';
export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}){
 const a=await access();if(!a.user)return new NextResponse('Unauthorized',{status:401});
 if(!a.companyId||!a.can('recruitment.view'))return new NextResponse('Forbidden',{status:403});
 const {id}=await ctx.params;const s=await db.essJobSubmission.findFirst({where:{id,companyId:a.companyId}});
 if(!s)return new NextResponse('Not found',{status:404});
 return new NextResponse(new Uint8Array(s.resumeData),{headers:{'Content-Type':s.resumeMime,'Content-Disposition':`attachment; filename="${s.resumeName.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
