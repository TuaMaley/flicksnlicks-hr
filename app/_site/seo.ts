import type {Metadata} from 'next';
// Search and social-sharing metadata for public pages. NEXORA_SITE_URL overrides the main address.
export const SITE_URL=(process.env.NEXORA_SITE_URL||'https://www.nexora-hrms.com').replace(/\/+$/,'');
export const OG_IMAGE={url:`${SITE_URL}/og/nexora-og.png`,width:1200,height:630,alt:'Nexora — Run your people, not paperwork'};
export function pageMeta(title:string,description:string,path:string,opts:{noindex?:boolean}={}):Metadata{
 const url=SITE_URL+path;
 return {title,description,alternates:{canonical:url},
  openGraph:{title,description,url,siteName:'Nexora',type:'website',locale:'en_US',images:[OG_IMAGE]},
  twitter:{card:'summary_large_image',title,description,images:[OG_IMAGE.url]},
  ...(opts.noindex?{robots:{index:false,follow:false}}:{})};
}
