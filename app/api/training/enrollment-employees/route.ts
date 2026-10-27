import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
export async function GET(req:NextRequest){
 const a=await access();if(!a.user)return fail('Unauthorized',401);
 if(!a.can('training.view'))return fail('Forbidden',403);
 const q=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,80);
 const branchId=req.nextUrl.searchParams.get('branchId')||undefined;
 const department=req.nextUrl.searchParams.get('department')||undefined;
 const position=req.nextUrl.searchParams.get('position')||undefined;
 const where:any={AND:[employeeWhere(a),{status:'ACTIVE'},...(branchId?[{branchId}]:[]),...(department?[{department}]:[]),...(position?[{position}]:[]),...(q?[{OR:[{firstName:{contains:q,mode:'insensitive'}},{lastName:{contains:q,mode:'insensitive'}},{employeeNo:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]}]:[])]};
 const employees=await db.employee.findMany({where,select:{id:true,employeeNo:true,firstName:true,lastName:true,email:true,department:true,position:true,branchId:true,branch:{select:{name:true}}},orderBy:[{firstName:'asc'},{lastName:'asc'}],take:500});
 return ok({employees});
}
