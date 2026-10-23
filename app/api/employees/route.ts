import { NextResponse } from 'next/server';
// Locked until authenticated user sessions and RBAC are implemented.
export async function GET(){return NextResponse.json({error:'Authentication required; employee API not enabled yet.'},{status:401});}
export async function POST(){return NextResponse.json({error:'Authentication required; employee API not enabled yet.'},{status:401});}
