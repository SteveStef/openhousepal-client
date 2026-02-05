'use client'

import Link from 'next/link'
import Footer from '@/components/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] dark:from-[#0B0B0B] dark:via-[#111111] dark:to-[#0B0B0B] transition-colors duration-300">
      

      {/* Content */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white dark:bg-[#151517] rounded-2xl p-8 md:p-12 shadow-lg border border-gray-200 dark:border-gray-800 transition-colors duration-300">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Terms of Service</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Last Updated: November 2, 2025</p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mb-8">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Please read these Terms of Service carefully before using our Service. By using OpenHousePal, you agree to be bound by these Terms. If you do not agree, do not use the Service.
              </p>
            </div>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using OpenHousePal ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Description of Service</h2>
                <p>
                  OpenHousePal provides a subscription-based platform for real estate professionals to create QR code-enabled sign-in forms for open houses and generate automated property showcases for potential buyers. The Service includes both Basic and Premium subscription tiers with varying features.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. Account Registration</h2>
                <p>
                  To use the Service, you must:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and update your information to keep it accurate and current</li>
                  <li>Maintain the security of your password and account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                  <li>Be a licensed real estate professional or authorized agent</li>
                </ul>
                <p className="mt-4">
                  You are responsible for all activities that occur under your account. You may not share your account credentials with others.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Subscription and Payment</h2>
                <p>
                  OpenHousePal offers subscription plans with a 14-day free trial period. By selecting a subscription plan:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>You agree to pay the subscription fee associated with your chosen plan</li>
                  <li>Subscriptions automatically renew on a monthly basis unless cancelled</li>
                  <li>Payment is processed through PayPal and subject to their terms and conditions</li>
                  <li>You will not be charged during the 14-day free trial period</li>
                  <li>After the trial, your subscription fee will be automatically charged monthly</li>
                  <li>All fees are non-refundable except as required by law</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Cancellation and Refunds</h2>
                <p>
                  You may cancel your subscription at any time through your account settings or by contacting our support team. Upon cancellation:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Your access will continue until the end of your current billing period</li>
                  <li>You will not be charged for subsequent billing periods</li>
                  <li>No refunds will be provided for partial months of service</li>
                  <li>Your data may be deleted after account termination</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Acceptable Use</h2>
                <p>
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Use the Service in any way that violates applicable federal, state, or local laws</li>
                  <li>Impersonate or attempt to impersonate another person or entity</li>
                  <li>Engage in any conduct that restricts or inhibits anyone's use of the Service</li>
                  <li>Use any automated system to access the Service in a manner that sends more requests than a human could reasonably produce</li>
                  <li>Attempt to gain unauthorized access to any portion of the Service</li>
                  <li>Use the Service to collect personal information about visitors without their consent</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Intellectual Property</h2>
                <p>
                  The Service and its original content, features, and functionality are owned by OpenHousePal and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not reproduce, distribute, modify, or create derivative works of our Service without explicit written permission.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Service Content and Information</h2>
                <p>
                  All property information, images, and data provided through the Service are sourced from third-party providers, including but not limited to Multiple Listing Services (MLS) via IDX programs. You acknowledge that you do not own any of this property content and your use of it is strictly limited to the functionality provided by the Service for professional real estate purposes.
                </p>
                <p className="mt-4">
                  Users do not upload their own property content to the platform. All rights to the software, platform architecture, data structures, and generated showcases remain exclusively with OpenHousePal and its data providers.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Data Collection and Privacy</h2>
                <p>
                  When you collect visitor information through open house sign-in forms, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Comply with all applicable privacy laws and regulations</li>
                  <li>Obtain necessary consents from visitors for data collection</li>
                  <li>Use collected data only for legitimate real estate purposes</li>
                  <li>Protect visitor information from unauthorized access or disclosure</li>
                </ul>
                <p className="mt-4">
                  Please review our <Link href="/privacy" className="text-[#8b7355] hover:text-[#7a6549] dark:text-[#C9A24D] dark:hover:text-[#b08d42] transition-colors">Privacy Policy</Link> for information about how we collect and use your data.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9.5 MLS and IDX Data Disclaimer</h2>
                <p>
                  OpenHousePal may display real estate listing information obtained from one or more multiple listing services (“MLS”) or Internet Data Exchange (“IDX”) programs through licensed agreements with third-party providers. OpenHousePal is not a real estate broker, does not represent buyers or sellers, and does not guarantee the accuracy, completeness, or timeliness of any MLS or IDX data displayed through the Service.
                </p>
                <p className="mt-4">
                  All listing information is provided by third parties and is subject to change without notice. You acknowledge and agree that you are solely responsible for ensuring that your use of the Service, including the display, distribution, and use of MLS or IDX content, complies with all applicable MLS rules, broker requirements, licensing agreements, and federal, state, and local laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Disclaimer of Warranties</h2>
                <p>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p className="mt-4">
                  We do not warrant that the Service will be uninterrupted, timely, secure, or error-free. We do not warrant the accuracy or completeness of any content or data provided through the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Limitation of Liability</h2>
                <p>
                  TO THE FULLEST EXTENT PERMITTED BY LAW, OPENHOUSEPAL SHALL NOT BE LIABLE FOR ANY DAMAGES WHATSOEVER, WHETHER DIRECT, INDIRECT, GENERAL, SPECIAL, COMPENSATORY, CONSEQUENTIAL, AND/OR INCIDENTAL, ARISING OUT OF OR RELATING TO THE USE OF THE SERVICE.
                </p>
                <p className="mt-4">
                  NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER, AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO ZERO DOLLARS ($0). YOU AGREE THAT YOUR SOLE AND EXCLUSIVE REMEDY FOR ANY DISPUTE WITH OPENHOUSEPAL IS TO STOP USING THE SERVICE.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless OpenHousePal, its officers, directors, employees, agents, and affiliates from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Your use or misuse of the Service</li>
                  <li>Your violation of these Terms of Service</li>
                  <li>Your violation of any rights of another person or entity</li>
                  <li>Your collection, storage, or use of visitor data through the Service</li>
                  <li>Any content you submit, post, or transmit through the Service</li>
                  <li>Your violation of any applicable laws, regulations, or third-party rights</li>
                </ul>
                <p className="mt-4">
                  This indemnification obligation will survive the termination of your account and your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. DMCA Copyright Policy</h2>
                <p>
                  We respect the intellectual property rights of others. If you believe that content available through the Service infringes your copyright, please notify us with the following information:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>A physical or electronic signature of the copyright owner or authorized representative</li>
                  <li>Identification of the copyrighted work claimed to have been infringed</li>
                  <li>Identification of the material that is claimed to be infringing and its location on the Service</li>
                  <li>Your contact information (address, telephone number, email address)</li>
                  <li>A statement that you have a good faith belief that the disputed use is not authorized</li>
                  <li>A statement under penalty of perjury that the information is accurate</li>
                </ul>
                <p className="mt-4">
                  Send DMCA notices to the support email located at the bottom of this page
                </p>
                <p className="mt-4">
                  We may terminate the accounts of repeat infringers in appropriate circumstances.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. Data Security and Breach Limitation</h2>
                <p>
                  While we implement reasonable security measures to protect your data and visitor information, no system is completely secure. You acknowledge and agree that:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>You use the Service at your own risk regarding data security</li>
                  <li>We are not liable for unauthorized access to or alteration, theft, or destruction of data</li>
                  <li>You are responsible for maintaining backup copies of your critical data</li>
                  <li>In the event of a data breach, our liability is limited as set forth in Section 11</li>
                </ul>
                <p className="mt-4">
                  We will make reasonable efforts to notify you of any security breach affecting your data as required by applicable law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">15. Force Majeure</h2>
                <p>
                  OpenHousePal shall not be liable for any failure or delay in performance due to causes beyond our reasonable control, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-2">
                  <li>Acts of God, natural disasters, or severe weather</li>
                  <li>War, terrorism, riots, or civil unrest</li>
                  <li>Government actions, laws, or regulations</li>
                  <li>Internet service provider failures or delays</li>
                  <li>Cyber attacks, hacking, or denial of service attacks</li>
                  <li>Third-party service provider outages (including but not limited to cloud hosting, payment processors, or API providers)</li>
                  <li>Pandemics or public health emergencies</li>
                </ul>
                <p className="mt-4">
                  During such events, our obligations under these Terms will be suspended for the duration of the force majeure event.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">16. Modifications to Service</h2>
                <p>
                  We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time without notice. We may also impose limits on certain features or restrict access to parts or all of the Service without notice or liability.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">17. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">18. Dispute Resolution and Arbitration Agreement</h2>
                <p className="font-semibold mb-2">
                  PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.
                </p>
                <p>
                  <strong>18.1 Informal Resolution.</strong> Before filing a claim, you agree to try to resolve the dispute informally by contacting us at our support email. We will attempt to resolve the dispute informally within 60 days.
                </p>
                <p className="mt-4">
                  <strong>18.2 Binding Arbitration.</strong> If we cannot resolve the dispute informally, you agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service will be settled by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration will be conducted in Delaware, and judgment on the arbitration award may be entered in any court having jurisdiction.
                </p>
                <p className="mt-4">
                  <strong>18.3 Class Action Waiver.</strong> YOU AND OPENHOUSEPAL AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. Unless both you and OpenHousePal agree otherwise, the arbitrator may not consolidate more than one person's claims and may not otherwise preside over any form of a representative or class proceeding.
                </p>
                <p className="mt-4">
                  <strong>18.4 Exceptions.</strong> Notwithstanding the foregoing, either party may bring a claim in small claims court if it qualifies. Additionally, either party may seek injunctive or other equitable relief in court to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights.
                </p>
                <p className="mt-4">
                  <strong>18.5 Opt-Out.</strong> You may opt out of this arbitration agreement within 30 days of first accepting these Terms by sending written notice to the support email with a subject line "Arbitration Opt-Out" and including your name, address, and account email.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">19. Governing Law and Venue</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. To the extent arbitration does not apply, you agree that any legal action or proceeding shall be brought exclusively in the state or federal courts located in Delaware, and you hereby consent to the personal jurisdiction and venue of such courts.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">20. Attorney's Fees</h2>
                <p>
                  In any action or proceeding to enforce rights under these Terms, the prevailing party will be entitled to recover its reasonable costs and attorneys' fees.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">21. Severability</h2>
                <p>
                  If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severable from these Terms and shall not affect the validity and enforceability of any remaining provisions. The failure of OpenHousePal to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">22. Entire Agreement</h2>
                <p>
                  These Terms, together with our Privacy Policy and any other legal notices published by us on the Service, constitute the entire agreement between you and OpenHousePal concerning the Service and supersede all prior or contemporaneous understandings and agreements, whether written or oral, regarding the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">23. Assignment</h2>
                <p>
                  You may not assign or transfer these Terms or your rights hereunder, in whole or in part, without our prior written consent. We may assign these Terms at any time without notice to you. Any attempted assignment in violation of this section shall be void.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">24. Contact Information</h2>
                <p>
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <p className="mt-2">
                  Email: admin@openhousepal.com
                </p>
                <p className="mt-2">
                  For DMCA copyright notices, use the same email with subject line "DMCA Notice"
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
