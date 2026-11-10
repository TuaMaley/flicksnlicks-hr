import type {MetadataRoute} from 'next';
// Public website pages for search engines (served at /sitemap.xml). Set NEXORA_SITE_URL if the main address changes.
const BASE=(process.env.NEXORA_SITE_URL||'https://www.nexora-hrms.com').replace(/\/+$/,'');
export default function sitemap():MetadataRoute.Sitemap{
 const now=new Date();
 const pages:[string,number,'weekly'|'monthly'|'yearly'][]=[
  ['/',1,'weekly'],['/features',.9,'monthly'],['/pricing',.9,'monthly'],['/request-demo',.8,'monthly'],
  ['/register',.8,'monthly'],['/about',.6,'monthly'],['/contact',.6,'monthly'],['/terms',.2,'yearly'],['/privacy',.2,'yearly'],
 ];
 return pages.map(([path,priority,changeFrequency])=>({url:BASE+path,lastModified:now,changeFrequency,priority}));
}
