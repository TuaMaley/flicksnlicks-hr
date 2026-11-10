import {pageMeta} from '../_site/seo';
import SiteFrame from '../_site/SiteFrame';
export const metadata=pageMeta('Privacy notice | Nexora','How Nexora handles personal data.','/privacy');
// NOTE FOR NEXORA: review this text with your legal adviser / Data Protection Commission registration before launch.
export default function Privacy(){
 return <SiteFrame>
  <section className="pagehead dark"><div className="wrap"><h1>Privacy notice</h1></div></section>
  <section className="sec"><div className="wrap prose">
  <p>This notice explains how Nexora handles personal data on this website and in the Nexora HR Management System. We aim to meet the requirements of Ghana’s Data Protection Act, 2012 (Act 843).</p>
  <h2>Website enquiries and registrations</h2>
  <p>When you book a demo, send a message or register a company, we collect the details you enter — such as names, work email addresses, phone numbers and company information — to respond to you, review the registration and set up your workspace. We also record a one-way hash of your network address to prevent abuse of our forms; we do not store the address itself.</p>
  <h2>Data inside a customer workspace</h2>
  <p>Employee and payroll records in a workspace belong to the customer organisation, which decides what is stored and who can see it. Nexora processes that data only to provide the service. Each company’s data is kept separate, access is controlled by roles the customer manages, and sensitive actions are recorded in an audit log.</p>
  <h2>Email</h2>
  <p>We send transactional emails — confirmations, invitations, password resets and notices about your account. We do not sell personal data or send marketing to employees of our customers.</p>
  <h2>Retention</h2>
  <p>Unconfirmed registrations stop being processed after their confirmation link expires. Website enquiries are kept while we are in contact with you and for a reasonable period afterwards. Customer workspace data is kept for the life of the subscription and then exported or deleted as agreed with the customer.</p>
  <h2>Your rights</h2>
  <p>You may ask to access or correct personal data we hold about you, or object to its processing. If you are an employee of a Nexora customer, contact your employer first, as they control your records. Otherwise, <a href="/contact">contact us</a>.</p>
 </div></section></SiteFrame>;
}
