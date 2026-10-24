import './styles.css';
import './phase4.css';
import './account-menu.css';
import AccountMenu from './components/AccountMenu';
export const metadata={title:'Flicks & Licks | HR Management',description:'Flicks & Licks HR management system'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AccountMenu/>{children}</body></html>};
