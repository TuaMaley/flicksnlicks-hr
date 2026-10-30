import {currentUser,clearSession} from '../../../../lib/auth';
import {ok} from '../../../../lib/http';
import {recordSecurityEvent} from '../../../../lib/accessSecurity';

export async function POST(){
 // Capture the account before removing the session.
 const user=await currentUser();
 await clearSession();
 if(user)await recordSecurityEvent('LOGOUT',user.id,{});
 return ok({success:true});
}
