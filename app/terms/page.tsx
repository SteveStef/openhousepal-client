'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">OH</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Open House Pal</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-lg border border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-600 mb-8">Last Updated: October 21, 2025</p>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Open House Pal ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
              <p>
                Open House Pal provides a subscription-based platform for real estate professionals to create QR code-enabled sign-in forms for open houses and generate automated property showcases for potential buyers. The Service includes both Basic and Premium subscription tiers with varying features.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription and Payment</h2>
              <p>
                Open House Pal offers subscription plans with a 14-day free trial period. By selecting a subscription plan:
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Cancellation and Refunds</h2>
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Acceptable Use</h2>
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by Open House Pal and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not reproduce, distribute, modify, or create derivative works of our Service without explicit written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. User Content</h2>
              <p>
                You retain ownership of any content you submit through the Service, including property information, photos, and visitor data. By using the Service, you grant us a limited license to use, store, and display your content solely for the purpose of providing the Service to you.
              </p>
              <p className="mt-4">
                You are responsible for ensuring you have the necessary rights and permissions for any content you upload, including property listings and images.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Collection and Privacy</h2>
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
                Please review our <Link href="/privacy" className="text-[#8b7355] hover:text-[#7a6549] transition-colors">Privacy Policy</Link> for information about how we collect and use your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="mt-4">
                We do not warrant that the Service will be uninterrupted, timely, secure, or error-free. We do not warrant the accuracy or completeness of any content or data provided through the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, OPEN HOUSE PAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="mt-4">
                Our total liability for any claims arising from or related to the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Modifications to Service</h2>
              <p>
                We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time without notice. We may also impose limits on certain features or restrict access to parts or all of the Service without notice or liability.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="mt-2">
                Email: support@openhousepal.com
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 hover:scale-105 text-center"
              >
                Create Account
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-white border-2 border-[#8b7355] text-[#8b7355] rounded-xl font-semibold hover:bg-[#8b7355] hover:text-white transition-all duration-300 hover:scale-105 text-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
