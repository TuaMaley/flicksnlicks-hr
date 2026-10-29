import {access} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
import {POLICY_VERSION,POLICY_EFFECTIVE_DATE,SANCTIONS_MATRIX} from '../../../../lib/disciplinaryPolicy';
export async function GET(){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('disciplinary.view'))return fail('Forbidden',403);return ok({version:POLICY_VERSION,effectiveDate:POLICY_EFFECTIVE_DATE,matrix:SANCTIONS_MATRIX,source:'Discipline & Conduct Policy V1, Appendix A, pages 6–7'});}
