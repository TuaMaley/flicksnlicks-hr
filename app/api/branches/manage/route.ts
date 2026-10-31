import {db} from '../../../../lib/db';
import {ok} from '../../../../lib/http';
import {branchManagerAccess} from '../../../../lib/branchManagerAccess';
export async function GET(){
  const result=await branchManagerAccess();
  if(result.error)return result.error;
  return ok({branches:await db.branch.findMany({where:{companyId:result.a!.companyId!},orderBy:{name:'asc'}})});
}
