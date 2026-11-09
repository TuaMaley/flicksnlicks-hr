import {NextResponse} from 'next/server';
import {touchSession,sessionIdentity} from '../../../../lib/auth';
export const runtime='nodejs';
export async function GET(){return NextResponse.json({active:Boolean(await sessionIdentity())},{headers:{'Cache-Control':'no-store'}})}
export async function POST(){const active=await touchSession();return NextResponse.json({active},{status:active?200:401,headers:{'Cache-Control':'no-store'}})}
