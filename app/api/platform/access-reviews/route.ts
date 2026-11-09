import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {displayRoleName} from '../../../../lib/displayRoleName';

export async function GET(req:NextRequest){
 const session=await currentUser();
 if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
 const actor=await db.user.findUnique({where:{id:session.id},select:{active:true,platformAdmin:true}});
 if(!actor?.active||!actor.platformAdmin)return NextResponse.json({error:'Platform administrator access required'},{status:403});
 const companyId=req.nextUrl.searchParams.get('companyId')?.trim()||'';
 if(companyId.length>100)return NextResponse.json({error:'Invalid company filter'},{status:400});
 if(companyId){const company=await db.company.findUnique({where:{id:companyId},select:{id:true}});if(!company)return NextResponse.json({error:'Company not found'},{status:404});}
 const membershipWhere=companyId?{companyId}:{};
 const reviewWhere=companyId?{companyId}:{};
 const [memberships,platformAdmins,reviews]=await Promise.all([
  db.companyMembership.findMany({where:membershipWhere,select:{id:true,active:true,companyId:true,company:{select:{name:true,active:true}},user:{select:{id:true,name:true,email:true,active:true,platformAdmin:true}},roles:{select:{role:{select:{id:true,name:true,active:true,protected:true,system:true,companyId:true}}}}},orderBy:{createdAt:'desc'},take:500}),
  db.user.findMany({where:{platformAdmin:true},select:{id:true,name:true,email:true,active:true},orderBy:{name:'asc'},take:100}),
  db.accessReview.findMany({where:reviewWhere,select:{id:true,userId:true,companyId:true,status:true,dueDate:true,notes:true,completedAt:true,createdAt:true,user:{select:{name:true,email:true}},reviewer:{select:{name:true,email:true}}},orderBy:{createdAt:'desc'},take:100})
 ]);
 const now=Date.now();
 const members=memberships.map(m=>({id:m.id,companyId:m.companyId,companyName:m.company.name,companyActive:m.company.active,active:m.active,user:m.user,roles:m.roles.map(x=>({...x.role,name:displayRoleName(x.role.name)})),flags:[...(!m.user.active?['Inactive user']:[]),...(!m.company.active?['Suspended company']:[]),...(m.user.platformAdmin?['Platform administrator also has company membership']:[]),...(m.roles.some(x=>!x.role.active)?['Inactive role assigned']:[]),...(m.roles.some(x=>x.role.companyId&&x.role.companyId!==m.companyId)?['Cross-company role assigned']:[])]}));
 return NextResponse.json({members,platformAdmins,reviews:reviews.map(r=>({...r,overdue:r.status==='OPEN'&&new Date(r.dueDate).getTime()<now})),limited:memberships.length===500||reviews.length===100||platformAdmins.length===100},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
