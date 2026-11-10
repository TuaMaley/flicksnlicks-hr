import SiteFrame from '../_site/SiteFrame';
export const metadata={title:'Terms of service | Nexora',description:'Terms for using Nexora HR Management System.'};
// NOTE FOR NEXORA: review this text with your legal adviser before launch and set the effective date.
export default function Terms(){
 return <SiteFrame>
  <section className="pagehead dark"><div className="wrap"><h1>Terms of service</h1></div></section>
  <section className="sec"><div className="wrap prose">
  <p>These terms apply when an organisation (“the customer”) registers for and uses Nexora HR Management System (“Nexora”). By registering, the person submitting the registration confirms that they are authorised to accept these terms on the customer’s behalf.</p>
  <h2>Registration and approval</h2>
  <p>Every registration is reviewed before a workspace is created. Nexora may ask for further information, and may decline a registration — for example where details cannot be verified or duplicate an existing customer. A workspace becomes active when the customer’s first administrator accepts their invitation and sets a password.</p>
  <h2>Accounts and access</h2>
  <ul><li>The customer’s administrators decide who may access the workspace and with which permissions.</li><li>Users must keep their sign-in details confidential and tell their administrator immediately about any suspected misuse.</li><li>The customer is responsible for the accuracy of the data it enters, including salary and statutory information used for payroll.</li></ul>
  <h2>Subscriptions and payment</h2>
  <p>Subscriptions are monthly or annual, start on the day the workspace is activated, and include the modules of the chosen plan. Invoices are payable within the terms stated on the invoice. Nexora may restrict access to a workspace whose subscription has ended or remains unpaid after notice.</p>
  <h2>Payroll calculations</h2>
  <p>Nexora calculates PAYE and SSNIT using the tax bands and rates configured in the system. The customer remains responsible for reviewing and approving each pay run and for its statutory filings and payments.</p>
  <h2>Customer data</h2>
  <p>The customer owns the data in its workspace. Nexora processes it only to provide the service, as described in the <a href="/privacy">privacy notice</a>. On request at the end of a subscription, Nexora will provide an export of the customer’s data before deletion.</p>
  <h2>Acceptable use</h2>
  <p>The service may not be used to store unlawful content, to attempt to access another customer’s data, or to interfere with the platform’s security or availability.</p>
  <h2>Changes</h2>
  <p>We may update these terms. Material changes will be notified to customer administrators by email before they take effect.</p>
  <h2>Contact</h2>
  <p>Questions about these terms: <a href="/contact">contact the Nexora team</a>.</p>
 </div></section></SiteFrame>;
}
