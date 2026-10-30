import {NextResponse} from 'next/server';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.can('access.users.manage'))return NextResponse.json({error:'Forbidden'},{status:403});
  const users=await db.user.findMany({
   select:{id:true,name:true,email:true,active:true,createdAt:true,updatedAt:true,
    employee:{select:{employeeNo:true,department:true,branch:{select:{name:true}}}},
    roles:{select:{role:{select:{id:true,name:true,active:true,permissions:{select:{permission:{select:{key:true}}}}}}}},
    scopes:{select:{id:true,department:true,branch:{select:{name:true}}}}
   },orderBy:{name:'asc'},take:500
  });
  const result=users.map(u=>({id:u.id,name:u.name,email:u.email,active:u.active,createdAt:u.createdAt,
   employeeNo:u.employee?.employeeNo||null,department:u.employee?.department||null,branch:u.employee?.branch.name||null,
   roles:u.roles.map(x=>x.role.name),
   permissions:[...new Set(u.roles.filter(x=>x.role.active).flatMap(x=>x.role.permissions.map(p=>p.permission.key)))].sort(),
   scopes:u.scopes.map(s=>({branch:s.branch?.name||null,department:s.department}))
  }));
  return NextResponse.json({users:result,limited:users.length===500},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('Access overview failed',e);return NextResponse.json({error:'Unable to load access overview'},{status:500})}
}
