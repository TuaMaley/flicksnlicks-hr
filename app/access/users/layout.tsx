import {redirect} from 'next/navigation';
import {access} from '../../../lib/auth';
export default async function UsersLayout({children}:{children:React.ReactNode}){const a=await access();if(!a.user)redirect('/login');if(!a.can('access.users.manage'))redirect('/access');return <>{children}</>;}
