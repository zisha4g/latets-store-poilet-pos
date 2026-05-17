import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShoppingCart } from 'lucide-react';

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    <div className="text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const PrivacyPolicyPage = () => {
  const lastUpdated = 'May 17, 2026';

  return (
    <>
      <Helmet>
        <title>Privacy Policy - 4G on Wheels</title>
        <meta
          name="description"
          content="4G on Wheels privacy policy: what data we collect, how we use it, and your rights — including SMS messaging consent and opt-out."
        />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-primary">
              <ShoppingCart className="w-7 h-7" />
              <span className="text-2xl font-bold">StorePilot</span>
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to home</Link>
          </nav>
        </header>

        <main className="container mx-auto px-6 py-12 max-w-3xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
          </div>

          <Section title="1. Who we are">
            <p>
              4G on Wheels ("4G on Wheels", "we", "us", or "our"), operating at
              app.4gonwheels.com, uses StorePilot software to run our point-of-sale, ordering,
              and phone communications. This policy explains what information we collect, how we
              use it, and the choices you have.
            </p>
            <p>
              If you have any questions about this policy, contact us at{' '}
              <a href="mailto:info@4gonwheels.com" className="text-primary hover:underline">
                info@4gonwheels.com
              </a>.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> name, email, phone number, store name, and business type.</li>
              <li><strong>Business data you enter:</strong> products, customers, orders, invoices, inventory, and similar records.</li>
              <li><strong>Communications data:</strong> phone numbers you dial or that call you, call recordings and voicemails (when enabled), SMS messages sent or received through the platform, and call metadata (duration, status, cost).</li>
              <li><strong>Payment data:</strong> processed by our payment partners (e.g. Stripe, Sola). We do not store full card numbers on our servers.</li>
              <li><strong>Technical data:</strong> IP address, browser type, device info, and usage logs needed to operate and secure the service.</li>
            </ul>
          </Section>

          <Section title="3. How we use information">
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and operate the StorePilot service for you and your customers.</li>
              <li>Process payments and route phone calls / SMS messages.</li>
              <li>Send service-related notifications (e.g. receipts, order updates, account alerts).</li>
              <li>Detect and prevent fraud, abuse, and security incidents.</li>
              <li>Comply with legal obligations.</li>
              <li>Improve the product (using aggregated or de-identified data).</li>
            </ul>
          </Section>

          <Section title="4. SMS / text messaging">
            <p>
              When you or your customers opt in to receive text messages from a 4G on Wheels
              phone number (for example, by placing an order, requesting delivery updates, or
              replying to start a conversation), we use that consent to send messages related to
              the requested service — such as order confirmations, delivery status, appointment
              reminders, and replies to inquiries.
            </p>
            <p>
              <strong>
                We do not sell, rent, or share mobile phone numbers, SMS opt-in information, or
                message content with third parties or affiliates for their marketing or
                promotional purposes.
              </strong>{' '}
              Phone numbers and message content are shared only with the messaging carriers and
              service providers (e.g. SignalWire) strictly necessary to deliver the messages you
              have requested.
            </p>
            <p>
              <strong>Opt-out:</strong> Reply <code className="px-1 bg-muted rounded">STOP</code> to any message to
              unsubscribe. Reply <code className="px-1 bg-muted rounded">HELP</code> for help, or contact us at{' '}
              <a href="mailto:info@4gonwheels.com" className="text-primary hover:underline">
                info@4gonwheels.com
              </a>. Message and data rates may apply. Message frequency varies.
            </p>
          </Section>

          <Section title="5. How we share information">
            <p>We share information only as needed to operate the service:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service providers</strong> who host or power StorePilot (e.g. Supabase, Stripe, SignalWire, Sola Payments). They are contractually limited to using the data only to provide their service to us.</li>
              <li><strong>Legal and safety:</strong> when required by law, subpoena, or to protect rights, property, or safety.</li>
              <li><strong>Business transfers:</strong> if StorePilot is involved in a merger, acquisition, or asset sale, information may transfer as part of that transaction.</li>
            </ul>
            <p>We do not sell your personal information.</p>
          </Section>

          <Section title="6. Data retention">
            <p>
              We keep account and business data for as long as your account is active and for a
              reasonable period afterwards to comply with legal, tax, and accounting obligations,
              or to resolve disputes. Call recordings and voicemails follow the retention policy
              configured in our phone system settings.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use industry-standard safeguards including encryption in transit (TLS), encrypted
              storage, role-based access controls, and regular monitoring. No system is 100%
              secure; please use a strong password and keep your login credentials confidential.
            </p>
          </Section>

          <Section title="8. Your rights">
            <p>
              Depending on where you live, you may have the right to access, correct, delete, or
              export your personal data, or to object to certain processing. To exercise these
              rights, email{' '}
              <a href="mailto:info@4gonwheels.com" className="text-primary hover:underline">
                info@4gonwheels.com
              </a>{' '}
              from the address on your account.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              4G on Wheels is intended for use by adults and is not directed to children under
              13. We do not knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this policy from time to time. We will post the new version here and
              update the "Last updated" date. Material changes will be announced in the app or by
              email.
            </p>
          </Section>

          <Section title="11. Contact us">
            <p>
              4G on Wheels<br />
              162 Adar Ct<br />
              Monsey, NY 10952<br />
              United States<br />
              Email: <a href="mailto:info@4gonwheels.com" className="text-primary hover:underline">info@4gonwheels.com</a><br />
              Website: <a href="https://app.4gonwheels.com" className="text-primary hover:underline">app.4gonwheels.com</a>
            </p>
          </Section>
        </main>

        <footer className="border-t border-border bg-secondary mt-12">
          <div className="container mx-auto px-6 py-8 text-center text-muted-foreground text-sm space-x-4">
            <span>&copy; {new Date().getFullYear()} 4G on Wheels. All Rights Reserved.</span>
            <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;
