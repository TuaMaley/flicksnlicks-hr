import {NextRequest,NextResponse} from 'next/server';
// Cookie presence is only a routing convenience; signed session validation happens server-side in every protected API.
// Public website: "/" shows the marketing home to signed-out visitors (and always on NEXORA_MARKETING_HOSTS, e.g.
// www.nexora-hrms.com); /api/public/* serves the website's forms. Public pages themselves are outside the matcher.
const marketingHosts=()=>(process.env.NEXORA_MARKETING_HOSTS||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 const session=req.cookies.get('fnl_session')?.value||(req.headers.get('authorization')?.startsWith('Bearer ')?'bearer':undefined);
 if(path==='/'){
  const host=(req.headers.get('host')||'').split(':')[0].toLowerCase();
  if(!session||marketingHosts().includes(host)){
   const headers=new Headers(req.headers);headers.set('x-nexora-surface','public');
   return NextResponse.rewrite(new URL('/welcome',req.url),{request:{headers}});
  }
  return NextResponse.next();
 }
 if(!session&&path!=='/login'&&!path.startsWith('/api/auth/')&&!path.startsWith('/api/health')&&!path.startsWith('/api/public/')&&path!=='/api/platform/administrators/accept'){if(path.startsWith('/api/'))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.redirect(new URL('/login',req.url))}
 return NextResponse.next();
}
export const config={matcher:['/','/employees/:path*','/leave/:path*','/access/:path*','/api/:path*']};
