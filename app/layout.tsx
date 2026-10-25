import './styles.css';
import './phase4.css';
import './account-menu.css';
import './persistent-sidebar.css';
import './fixed-header-scroll.css';
import ModuleShell from './components/ModuleShell';
export const metadata={title:'Flicks & Licks | HR Management',description:'Flicks & Licks HR management system'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ModuleShell>{children}</ModuleShell></body></html>};
