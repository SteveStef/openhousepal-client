'use client'

import Link from 'next/link'
import Footer from '@/components/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] dark:from-[#0B0B0B] dark:via-[#111111] dark:to-[#0B0B0B] transition-colors duration-300">
      

      {/* Content */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white dark:bg-[#151517] rounded-2xl p-8 md:p-12 shadow-lg border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Privacy Policy</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Last Updated: October 21, 2025</p>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
                <p>
                  Open House Pal ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read this policy carefully to understand our practices regarding your personal data.
                </p>
                <p className="mt-4">
                  By using our Service, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>

                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-4">2.1 Information You Provide</h3>
                <p>We collect information that you voluntarily provide when using our Service:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Account Information:</strong> First name, last name, email address, state, brokerage name, and password</li>
                  <li><strong>Subscription Information:</strong> Payment details processed through PayPal (we do not store credit card information)</li>
                  <li><strong>Property Information:</strong> Property listings, addresses, descriptions, and photos you upload</li>
                  <li><strong>Communication Data:</strong> Messages you send us through support channels</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-4">2.2 Visitor Data You Collect</h3>
                <p>
                  When you use our open house sign-in forms, you may collect information from property visitors. This information is stored in your account and you are the data controller for this information. Typical visitor data includes:
                </p>
                <p className="mt-4">
                  OpenHousePal acts solely as a data processor with respect to visitor information collected through the Service and processes such data only on behalf of and under the instructions of the user.
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Visitor names and contact information</li>
                  <li>Visit timestamps and property interests</li>
                  <li>Any additional information you choose to collect through custom forms</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-4">2.3 Automatically Collected Information</h3>
                <p>When you access our Service, we automatically collect certain information:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                  <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the Service, click patterns</li>
                  <li><strong>Cookies and Tracking:</strong> Session cookies, analytics cookies, and preference cookies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
                <p>We use the collected information for the following purposes:</p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Service Delivery:</strong> To provide, maintain, and improve our Service features</li>
                  <li><strong>Account Management:</strong> To create and manage your account, process subscriptions, and authenticate users</li>
                  <li><strong>Communication:</strong> To send important updates, security alerts, and support messages</li>
                  <li><strong>Showcase Generation:</strong> To create automated property showcases based on your property data</li>
                  <li><strong>Analytics:</strong> To analyze usage patterns and improve user experience</li>
                  <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security incidents</li>
                  <li><strong>Legal Compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. How We Share Your Information</h2>
                <p>We do not sell your personal information. We may share your information in the following circumstances:</p>

                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Service Providers:</strong> With third-party vendors who perform services on our behalf (e.g., PayPal for payment processing, hosting providers, analytics services)</li>
                  <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  <li><strong>Protection of Rights:</strong> To protect our rights, property, or safety, or that of our users</li>
                  <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Your Responsibilities as a Data Controller</h2>
                <p>
                  When you collect visitor information through our open house forms, you act as the data controller for that information. You are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Obtaining necessary consents from visitors before collecting their information</li>
                  <li>Complying with applicable privacy laws (e.g., GDPR, CCPA)</li>
                  <li>Providing visitors with notice about how their data will be used</li>
                  <li>Responding to visitor requests regarding their data (access, deletion, etc.)</li>
                  <li>Maintaining appropriate security measures for visitor data</li>
                  <li>Using visitor data only for legitimate real estate business purposes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Cookies and Tracking Technologies</h2>
                <p>
                  We use cookies and similar tracking technologies to enhance your experience on our Service:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Essential Cookies:</strong> Required for authentication and core functionality</li>
                  <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Service</li>
                  <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                </ul>
                <p className="mt-4">
                  You can control cookies through your browser settings, but disabling certain cookies may affect the functionality of our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Data Security</h2>
                <p>
                  We implement industry-standard security measures to protect your information:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>256-bit SSL encryption for data in transit</li>
                  <li>Secure password hashing and storage</li>
                  <li>Regular security audits and updates</li>
                  <li>Access controls and authentication requirements</li>
                  <li>Secure database infrastructure</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Data Retention</h2>
                <p>
                  We retain your personal information for as long as necessary to provide our Service and fulfill the purposes outlined in this Privacy Policy:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Account Data:</strong> Retained while your account is active and for a reasonable period after cancellation</li>
                  <li><strong>Visitor Data:</strong> Retained based on your settings and data management practices</li>
                  <li><strong>Transaction Records:</strong> Retained for accounting and legal compliance purposes (typically 7 years)</li>
                  <li><strong>Analytics Data:</strong> Aggregated data may be retained indefinitely in anonymized form</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Your Privacy Rights</h2>
                <p>
                  Depending on your location, you may have certain rights regarding your personal information:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
                  <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
                  <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                  <li><strong>Object:</strong> Object to certain processing of your personal information</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us at privacy@openhousepal.com.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. California Privacy Rights (CCPA)</h2>
                <p>
                  If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Right to know what personal information is collected, used, shared, or sold</li>
                  <li>Right to delete personal information held by us</li>
                  <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
                  <li>Right to non-discrimination for exercising your CCPA rights</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Children's Privacy</h2>
                <p>
                  Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child without parental consent, we will take steps to delete such information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Third-Party Links</h2>
                <p>
                  Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites you visit.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your country of residence. We ensure that appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of material changes by:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Updating the "Last Updated" date at the top of this policy</li>
                  <li>Sending an email notification to your registered email address</li>
                  <li>Displaying a prominent notice on our Service</li>
                </ul>
                <p className="mt-4">
                  Your continued use of the Service after such modifications constitutes your acceptance of the updated Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">15. Contact Us</h2>
                <p>
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="mt-4 space-y-1">
                  <p><strong>Email:</strong> privacy@openhousepal.com</p>
                  <p><strong>Support:</strong> support@openhousepal.com</p>
                </div>
                <p className="mt-4">
                  For questions about our Terms of Service, please visit our <Link href="/terms" className="text-[#8b7355] hover:text-[#7a6549] dark:text-[#C9A24D] dark:hover:text-[#b08d42] transition-colors">Terms of Service</Link> page.
                </p>
              </section>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/register"
                  className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105 text-center"
                >
                  Create Account
                </Link>
                <Link
                  href="/"
                  className="px-6 py-3 bg-white dark:bg-transparent border-2 border-[#8b7355] dark:border-[#C9A24D] text-[#8b7355] dark:text-[#C9A24D] rounded-xl font-semibold hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white dark:hover:text-[#111827] transition-all duration-300 hover:scale-105 text-center"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}