'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function PaymentSetupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card'>('paypal')
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: ''
  })

  const handlePayPalSetup = async () => {
    setIsLoading(true)
    
    // Simulate PayPal integration
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to dashboard on successful setup
      window.location.href = '/dashboard'
    }, 2000)
  }

  const handleCardSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate card processing
    setTimeout(() => {
      setIsLoading(false)
      // Redirect to dashboard on successful setup
      window.location.href = '/dashboard'
    }, 2000)
  }

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardData({
      ...cardData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center px-6 py-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">EP</span>
            </div>
            <span className="text-2xl font-bold text-white">EntryPoint™</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Complete your setup</h2>
          <p className="text-zinc-400">Start your free month, then $50/month. Cancel anytime.</p>
        </div>

        {/* Payment Setup */}
        <div className="bg-zinc-900/40 rounded-2xl p-6 border border-zinc-800/60 backdrop-blur-sm">
          {/* Subscription Summary */}
          <div className="bg-zinc-800/50 rounded-xl p-4 mb-5 border border-zinc-700/30">
            <h3 className="text-lg font-semibold text-white mb-3">Your Plan</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-300">EntryPoint™ Pro</span>
              <span className="text-white font-semibold">Free</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm">First month (trial)</span>
              <span className="text-zinc-400 text-sm">$0.00</span>
            </div>
            <div className="border-t border-zinc-700/50 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-300">Then $50/month</span>
                <span className="text-zinc-400 text-sm">Starting {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
              </div>
            </div>
            
            {/* Features included */}
            <div className="mt-3 pt-3 border-t border-zinc-700/30">
              <p className="text-zinc-400 text-sm mb-1">Includes:</p>
              <ul className="text-zinc-300 text-sm space-y-0.5">
                <li>• Unlimited QR code generation</li>
                <li>• Property collection management</li>
                <li>• Advanced analytics</li>
                <li>• Priority support</li>
              </ul>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">Choose payment method</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('paypal')}
                className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                  paymentMethod === 'paypal'
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-700/50 bg-zinc-800/30 text-zinc-300 hover:border-zinc-600/50'
                }`}
              >
                <div className="text-lg font-semibold mb-1">PayPal</div>
                <div className="text-xs opacity-75">Secure & Easy</div>
              </button>
              
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                  paymentMethod === 'card'
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-700/50 bg-zinc-800/30 text-zinc-300 hover:border-zinc-600/50'
                }`}
              >
                <div className="text-lg font-semibold mb-1">Card</div>
                <div className="text-xs opacity-75">Visa, Mastercard</div>
              </button>
            </div>
          </div>

          {/* PayPal Setup */}
          {paymentMethod === 'paypal' && (
            <div className="space-y-4">
              <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/30">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">PP</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">PayPal Payment</h4>
                    <p className="text-zinc-400 text-sm">You'll be redirected to PayPal to complete setup</p>
                  </div>
                </div>
                <p className="text-zinc-300 text-sm">
                  After clicking continue, you'll authorize PayPal for your monthly subscription. 
                  Your first month is free, then $50/month.
                </p>
              </div>
              
              <button
                onClick={handlePayPalSetup}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Setting up PayPal...
                  </div>
                ) : (
                  'Continue with PayPal'
                )}
              </button>
            </div>
          )}

          {/* Card Setup */}
          {paymentMethod === 'card' && (
            <form onSubmit={handleCardSetup} className="space-y-4">
              <div>
                <label htmlFor="cardholderName" className="block text-sm font-medium text-zinc-300 mb-2">
                  Cardholder name
                </label>
                <input
                  id="cardholderName"
                  name="cardholderName"
                  type="text"
                  required
                  value={cardData.cardholderName}
                  onChange={handleCardChange}
                  className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-zinc-300 mb-2">
                  Card number
                </label>
                <input
                  id="cardNumber"
                  name="cardNumber"
                  type="text"
                  required
                  value={cardData.cardNumber}
                  onChange={handleCardChange}
                  className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                  placeholder="1234 5678 9012 3456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expiryDate" className="block text-sm font-medium text-zinc-300 mb-2">
                    Expiry date
                  </label>
                  <input
                    id="expiryDate"
                    name="expiryDate"
                    type="text"
                    required
                    value={cardData.expiryDate}
                    onChange={handleCardChange}
                    className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                    placeholder="MM/YY"
                  />
                </div>
                
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-zinc-300 mb-2">
                    CVV
                  </label>
                  <input
                    id="cvv"
                    name="cvv"
                    type="text"
                    required
                    value={cardData.cvv}
                    onChange={handleCardChange}
                    className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                    placeholder="123"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing payment...
                  </div>
                ) : (
                  'Complete setup'
                )}
              </button>
            </form>
          )}

          {/* Security & Terms */}
          <div className="mt-5 pt-4 border-t border-zinc-700/30">
            <div className="flex items-center space-x-2 text-zinc-400 text-sm mb-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Your payment information is secure and encrypted</span>
            </div>
            <p className="text-zinc-500 text-xs">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
                Privacy Policy
              </Link>
              . You can cancel your subscription at any time.
            </p>
          </div>
        </div>

        {/* Back to Registration */}
        <div className="text-center">
          <Link href="/register" className="text-zinc-400 hover:text-zinc-300 text-sm transition-colors">
            ← Back to registration
          </Link>
        </div>
      </div>
    </div>
  )
}