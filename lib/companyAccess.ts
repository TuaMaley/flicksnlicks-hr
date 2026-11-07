import {db} from './db';

export const SUSPENDED_COMPANY_MESSAGE = 'Contact the administrator for more information';

/** Company.active=false is the existing platform suspension switch. */
export async function companyAccessState(user:{id:string;platformAdmin:boolean}) {
  if(user.platformAdmin) return 'allowed' as const;
  const memberships=await db.companyMembership.findMany({
    where:{userId:user.id,active:true},
    select:{company:{select:{active:true}}}
  });
  if(memberships.some(m=>m.company.active))return 'allowed' as const;
  if(memberships.some(m=>!m.company.active))return 'suspended' as const;
  return 'no_membership' as const;
}
