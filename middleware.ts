import {NextRequest,NextResponse} from 'next/server';
// Cookie presence is only a routing convenience; signed session validation happens server-side in every protected API.
//
// Hosts (Railway variables, comma-separated, no https://):
//   NEXORA_MARKETING_HOSTS  e.g. nexora-hrms.com,www.nexora-hrms.com — always the public website. Anything that is not
//                           a website page (sign-in, dashboard, modules) is sent to NEXORA_APP_HOST.
//   NEXORA_APP_HOST         e.g. app.nexora-hrms.com — the HRMS. "/" is the dashboard, or sign-in when signed out.
// With neither set, "/" shows the website to signed-out visitors and the dashboard to signed-in users (previous behaviour).

const list=(v?:string)=>(v||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
const marketingHosts=()=>list(process.env.NEXORA_MARKETING_HOSTS);
const appHost=()=>list(process.env.NEXORA_APP_HOST)[0]||'';

// Pages and endpoints the public website needs. Everything else on a marketing host belongs to the app.
const SITE_PAGES=['/','/welcome','/features','/pricing','/about','/contact','/request-demo','/register','/accept-invitation','/terms','/privacy'];
const isSitePath=(p:string)=>SITE_PAGES.some(s=>p===s||(s!=='/'&&p.startsWith(s+'/')))||p.startsWith('/api/public/')||p.startsWith('/api/health')||p==='/api/platform/administrators/accept';

// Routes that required a session before this change (the original matcher).
const isProtected=(p:string)=>p==='/'||/^\/(employees|leave|access)(\/|$)/.test(p)||p.startsWith('/api/');

const showWebsite=(req:NextRequest)=>{
 const headers=new Headers(req.headers);headers.set('x-nexora-surface','public');
 return NextResponse.rewrite(new URL('/welcome',req.url),{request:{headers}});
};

export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 const host=(req.headers.get('host')||'').split(':')[0].toLowerCase();
 const session=req.cookies.get('fnl_session')?.value||(req.headers.get('authorization')?.startsWith('Bearer ')?'bearer':undefined);
 const app=appHost();

 // Website domain: always the website; app pages move to the app domain.
 if(marketingHosts().includes(host)){
  if(path==='/')return showWebsite(req);
  if(isSitePath(path))return NextResponse.next();
  // API routes answer on both domains so the mobile app and existing integrations keep working.
  if(path.startsWith('/api/')){/* fall through to the normal session check below */}
  else if(app&&app!==host){const to=new URL(req.nextUrl.pathname+req.nextUrl.search,`https://${app}`);return NextResponse.redirect(to,307)}
 }

 if(path==='/'){
  if(session)return NextResponse.next();
  if(app&&host===app)return NextResponse.redirect(new URL('/login',req.url));
  return showWebsite(req);
 }
 if(!isProtected(path))return NextResponse.next();
 if(!session&&path!=='/login'&&!path.startsWith('/api/auth/')&&!path.startsWith('/api/health')&&!path.startsWith('/api/public/')&&path!=='/api/platform/administrators/accept'){if(path.startsWith('/api/'))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.redirect(new URL('/login',req.url))}
 return NextResponse.next();
}
// Every page and API route, except Next.js build files and files with an extension (images, video, robots.txt, sitemap.xml).
export const config={matcher:['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)']};
