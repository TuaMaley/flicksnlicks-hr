import {pageMeta} from '../../_site/seo';
import SiteFrame from '../../_site/SiteFrame';
import VerifyClient from './VerifyClient';
export const metadata=pageMeta('Confirm your email | Nexora','Confirm your email to send your company registration to the Nexora team.','/register/verify',{noindex:true});
export default function Verify(){return <SiteFrame><section className="sec fog"><div className="wrap" style={{maxWidth:680}}><div className="panel"><VerifyClient/></div></div></section></SiteFrame>}
