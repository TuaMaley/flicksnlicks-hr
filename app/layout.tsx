import './styles.css';
import './phase4.css';
import './account-menu.css';
import './persistent-sidebar.css';
import './workspace-switcher.css';
import './fixed-header-scroll.css';
import './nexora-modern-cards.css';
import './nexora-module-cards.css';
import './nexora-card-consistency.css';
import './mobile-responsive.css';
import ModuleShell from './components/ModuleShell';
import IdleSessionGuard from './components/IdleSessionGuard';
import {headers} from 'next/headers';
export const metadata = {
  metadataBase: new URL('https://app.nexora-hrms.com'),
  title: 'Nexora | HR Management Platform',
  description: 'Nexora is a modern HR management platform for managing people, performance, payroll, and organizational growth.',
  openGraph: {
    title: 'Nexora | HR Management Platform',
    description: 'People, performance, growth. Manage your workforce with Nexora.',
    url: 'https://app.nexora-hrms.com',
    siteName: 'Nexora',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Nexora | HR Management Platform',
    description: 'People, performance, growth. Manage your workforce with Nexora.',
  },
};
// The public home page is served at "/" via a middleware rewrite; the header tells the shell and idle guard to stay out of it.
export default async function RootLayout({children}:{children:React.ReactNode}){const publicSurface=(await headers()).get('x-nexora-surface')==='public';return <html lang="en"><body><IdleSessionGuard bare={publicSurface}/><ModuleShell bare={publicSurface}>{children}</ModuleShell></body></html>};
