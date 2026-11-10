import {db} from '../../../../lib/db';
import {ok} from '../../../../lib/http';
import {gate} from '../../../../lib/nexhr';
export async function GET(){const {a,error}=await gate('nexhr.approve');if(error)return error;
 const events=await db.nexHrAuditEvent.findMany({where:{companyId:a.companyId!},orderBy:{createdAt:'desc'},take:200});return ok({events});}
