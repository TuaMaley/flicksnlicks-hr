import {NextRequest,NextResponse} from 'next/server';
// Cookie presence is only a routing convenience; signed session validation happens server-side in every protected API.
export function middleware(req:NextRequest){const path=req.nextUrl.pathname;const session=req.cookies.get('fnl_session')?.value;if(!session&&path!=='/login'&&!path.startsWith('/api/auth/')&&!path.startsWith('/api/health')){if(path.startsWith('/api/'))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.redirect(new URL('/login',req.url))}return NextResponse.next()}
export const config={matcher:['/','/employees/:path*','/access/:path*','/api/:path*']};
