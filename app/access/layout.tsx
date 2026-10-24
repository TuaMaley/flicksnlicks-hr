import {redirect} from 'next/navigation';
import {access} from '../../lib/auth';
export default async function ProtectedLayout({children}:{children:React.ReactNode}){
 const session=await access();
 if(!session.user)redirect('/login');
 if(!session.can('access.view'))redirect('/?access=denied');
 return <>{children}</>;
}
