import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';

export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const user=await db.user.findUnique({where:{id:a.user.id},select:{id:true,name:true,email:true,active:true,platformAdmin:true,createdAt:true,updatedAt:true,employeeId:true,roles:{select:{role:{select:{name:true}}}},companyMemberships:{where:{active:true},select:{companyId:true,company:{select:{name:true}},roles:{select:{role:{select:{name:true}}}}}}}});
 if(!user)return NextResponse.json({error:'Account not found'},{status:404});
 const employee=user.employeeId&&a.companyId?await db.employee.findFirst({where:{id:user.employeeId,companyId:a.companyId},select:{employeeNo:true,firstName:true,lastName:true,email:true,phone:true,position:true,department:true,status:true,employmentType:true,hireDate:true,branch:{select:{name:true}},profilePhotoDataUrl:true}}):null;
 const companies=user.companyMemberships.map(m=>({name:m.company.name,roles:m.roles.map(r=>r.role.name)}));
 return NextResponse.json({profile:{name:user.name,email:user.email,active:user.active,platformAdmin:user.platformAdmin,createdAt:user.createdAt,updatedAt:user.updatedAt,roles:user.roles.map(r=>r.role.name),companies,employee}}, {headers:{'Cache-Control':'no-store'}});
}
