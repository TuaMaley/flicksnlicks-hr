import {db} from './db';
import {PERMISSIONS} from './permissions';
export async function entitledPermissions(companyId:string){
 const modules=await db.companyModule.findMany({where:{companyId,enabled:true},select:{moduleKey:true}});
 const enabled=new Set(modules.map(m=>m.moduleKey));
 return PERMISSIONS.filter(p=>enabled.has(p.split('.')[0]));
}
