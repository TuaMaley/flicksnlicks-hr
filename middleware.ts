import {NextRequest,NextResponse} from 'next/server';
/**
 * Browser origins allowed to call the API with a bearer token (the hosted Employee Self-Service web app).
 * Comma-separated list in the EMPLOYEE_APP_ORIGINS env var, e.g. "https://employee.nexora-hrms.com,http://localhost:8081".
 * Native iOS/Android builds send no Origin header and are unaffected.
 */
const allowedOrigins=(process.env.EMPLOYEE_APP_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
function cors(req:NextRequest,res:NextResponse){const origin=req.headers.get('origin');if(origin&&allowedOrigins.includes(origin)){res.headers.set('Access-Control-Allow-Origin',origin);res.headers.set('Vary','Origin');res.headers.set('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');res.headers.set('Access-Control-Allow-Headers','Authorization,Content-Type,x-nexora-company');res.headers.set('Access-Control-Expose-Headers','Content-Disposition');res.headers.set('Access-Control-Max-Age','600')}return res}
// Cookie presence is only a routing convenience; signed session validation happens server-side in every protected API.
export function middleware(req:NextRequest){const path=req.nextUrl.pathname;
 if(path.startsWith('/api/')&&req.method==='OPTIONS')return cors(req,new NextResponse(null,{status:204}));
 const session=req.cookies.get('fnl_session')?.value||(req.headers.get('authorization')?.startsWith('Bearer ')?'bearer':undefined);
 if(!session&&path!=='/login'&&!path.startsWith('/api/auth/')&&!path.startsWith('/api/health')){if(path.startsWith('/api/'))return cors(req,NextResponse.json({error:'Unauthorized'},{status:401}));return NextResponse.redirect(new URL('/login',req.url))}
 return path.startsWith('/api/')?cors(req,NextResponse.next()):NextResponse.next()}
export const config={matcher:['/','/employees/:path*','/leave/:path*','/access/:path*','/api/:path*']};
