// Shared header/footer for the public website. Plain <a> links on purpose: the home page is served at "/"
// through a middleware rewrite, so every public navigation is a full page load.
import './site.css';
import {Menu} from 'lucide-react';
const NAV=[['home','Home','/'],['features','Features','/features'],['pricing','Pricing','/pricing'],['about','About','/about'],['contact','Contact','/contact']] as const;
export default function SiteFrame({active,children}:{active?:string;children:React.ReactNode}){
 return <div className="nx">
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
  {/* React 19 hoists precedence stylesheets into <head>. */}
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" precedence="default"/>
  <header className="nx-head"><div className="wrap">
   <a className="nx-logo" href="/" aria-label="Nexora home"><img src="/nexora-wordmark-light.png" alt="Nexora — People, Performance, Growth" width={132} height={38}/></a>
   <nav className="nx-nav" aria-label="Main">{NAV.map(([k,l,h])=><a key={k} href={h} aria-current={active===k?'page':undefined}>{l}</a>)}</nav>
   <a className="signin desk" href="/login">Sign in</a>
   <a className="btn btn-red desk" href="/request-demo">Book a demo</a>
   <details className="nx-menu"><summary><Menu size={18} aria-hidden="true"/>Menu</summary><div className="nx-menu-panel">
    {NAV.map(([k,l,h])=><a key={k} href={h}>{l}</a>)}<a href="/request-demo">Book a demo</a><a href="/login">Sign in</a>
    <a className="btn btn-red" href="/register">Register your company</a>
   </div></details>
  </div></header>
  <main id="main">{children}</main>
  <div className="band" aria-hidden="true"/>
  <footer className="nx-foot"><div className="wrap">
   <div className="cols">
    <div className="fbrand"><img src="/nexora-wordmark-light.png" alt="Nexora" width={139} height={40}/><p style={{maxWidth:'34ch'}}>HR, payroll and employee self-service for growing businesses.</p></div>
    <div><b>Product</b><a href="/features">Features</a><a href="/pricing">Pricing</a><a href="/request-demo">Book a demo</a><a href="https://employee.nexora-hrms.com">Employee self-service</a></div>
    <div><b>Company</b><a href="/about">About</a><a href="/contact">Contact</a><a href="/register">Register your company</a></div>
    <div><b>Account</b><a href="/login">Sign in</a><a href="/forgot-password">Reset password</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
   </div>
   <div className="base"><span>© {new Date().getFullYear()} Nexora HR Management System</span><span>nexora-hrms.com</span></div>
  </div></footer>
 </div>;
}

/** Shared public-form field. */
export function Field({id,label,optional,error,hint,children,full}:{id:string;label:string;optional?:boolean;error?:string;hint?:string;children:React.ReactNode;full?:boolean}){
 return <div className={'field'+(full?' full':'')}><label htmlFor={id}>{label}{optional&&<span className="opt"> (optional)</span>}</label>{children}{hint&&!error&&<span className="hint" id={id+'-hint'}>{hint}</span>}{error&&<span className="err" id={id+'-err'} role="alert">{error}</span>}</div>;
}
