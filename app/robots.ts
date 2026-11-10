import type {MetadataRoute} from 'next';
// Served at /robots.txt: lets search engines index the public website and keeps the HRMS app and APIs out.
const BASE=(process.env.NEXORA_SITE_URL||'https://www.nexora-hrms.com').replace(/\/+$/,'');
export default function robots():MetadataRoute.Robots{
 return {
  rules:[{userAgent:'*',allow:['/','/features','/pricing','/about','/contact','/request-demo','/register','/terms','/privacy','/art/','/media/'],
   disallow:['/api/','/platform','/employees','/leave','/payroll','/access','/settings','/self-service','/reports','/accept-invitation','/register/verify','/reset-password','/forgot-password','/platform-invite','/welcome']}],
  sitemap:`${BASE}/sitemap.xml`,
  host:BASE,
 };
}
