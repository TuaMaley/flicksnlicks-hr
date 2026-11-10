import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
import AcceptClient from './AcceptClient';
export const metadata=pageMeta('Activate your workspace | Nexora','Activate your company workspace on Nexora.','/accept-invitation',{noindex:true});
export default function Accept(){return <SiteFrame><section className="sec fog"><div className="wrap" style={{maxWidth:680}}><div className="panel"><AcceptClient/></div></div></section></SiteFrame>}
