import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId||!a.can('employees.edit'))return NextResponse.json({error:'Forbidden'},{status:403});
 const employees=await db.employee.findMany({where:{companyId:a.companyId,status:{not:'EXITED'}},select:{id:true,firstName:true,lastName:true,position:true},orderBy:[{firstName:'asc'},{lastName:'asc'}]});
 return NextResponse.json({employees},{headers:{'Cache-Control':'no-store'}});
}
