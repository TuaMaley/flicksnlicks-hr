import {NextRequest} from 'next/server';
import {db} from '../../../lib/db';
import {access} from '../../../lib/auth';
import {fail,ok} from '../../../lib/http';
import {requireCompanyAdministrator} from './admin';
export async function GET(){
 const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.companyId)return fail('Select a company',403);
 return ok({departments:await db.companyDepartment.findMany({where:{companyId:a.companyId},orderBy:{name:'asc'}})});
}
export async function POST(req:NextRequest){
 const g=await requireCompanyAdministrator();if(g.error)return g.error;const a=g.a!;
 const b=await req.json().catch(()=>null);const name=typeof b?.name==='string'?b.name.trim():'';
 if(name.length<2||name.length>100)return fail('Department name must be 2–100 characters',400);
 try{return ok({department:await db.companyDepartment.create({data:{companyId:a.companyId!,name}})},201)}
 catch(e:any){return fail(e.code==='P2002'?'Department already exists':'Could not create department',e.code==='P2002'?409:500)}
}
export async function PATCH(req:NextRequest){
 const g=await requireCompanyAdministrator();if(g.error)return g.error;const a=g.a!;
 const b=await req.json().catch(()=>null);const name=typeof b?.name==='string'?b.name.trim():'';
 if(typeof b?.id!=='string'||name.length<2||name.length>100||typeof b.active!=='boolean')return fail('Invalid update',400);
 const found=await db.companyDepartment.findFirst({where:{id:b.id,companyId:a.companyId!}});
 if(!found)return fail('Department not found',404);
 try{return ok({department:await db.companyDepartment.update({where:{id:found.id},data:{name,active:b.active}})})}
 catch(e:any){return fail(e.code==='P2002'?'Department already exists':'Update failed',e.code==='P2002'?409:500)}
}
