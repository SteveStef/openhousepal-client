'use client'

import { useState } from 'react'
import { Property, SignInFormData } from '@/types'

interface OpenHouseSignInFormProps {
  property: Property;
  onSubmit: (formData: SignInFormData) => Promise<void>;
  isLoading?: boolean;
}

export default function OpenHouseSignInForm({ 
  property, 
  onSubmit, 
  isLoading = false 
}: OpenHouseSignInFormProps) {
  const [formData, setFormData] = useState<SignInFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredContact: 'EMAIL',
    visitingReason: '',
    timeframe: '',
    priceRange: '',
    interestedInSimilar: false,
    additionalComments: ''
  })

  const [currentStep, setCurrentStep] = useState(1)
  const [showCollectionOffer, setShowCollectionOffer] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (currentStep === 4) {
      setShowCollectionOffer(true)
      return
    }
    
    await onSubmit(formData)
  }

  const handleCollectionResponse = async (interested: boolean) => {
    const finalData = { ...formData, interestedInSimilar: interested }
    await onSubmit(finalData)
  }

  const formatPrice = (price?: number) => {
    return price ? `$${price.toLocaleString()}` : 'Price Available Upon Request'
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Welcome! Let's get your name"
      case 2: return "How can we reach you?"
      case 3: return "Tell us about your visit"
      case 4: return "One final question"
      default: return "Sign In"
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return "First, let's get to know you"
      case 2: return "We'll need your contact information"
      case 3: return "Help us understand your visit"
      case 4: return "Any additional thoughts?"
      default: return ""
    }
  }

  if (showCollectionOffer) {
    return (
      <div className="max-w-lg mx-auto bg-black/95 rounded-3xl shadow-2xl border border-zinc-800/60 backdrop-blur-lg">
        <div className="p-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-zinc-700 via-zinc-800 to-black rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-zinc-700/40">
              <svg className="w-10 h-10 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight font-light">Thank you for visiting</h2>
            <p className="text-zinc-400 text-base leading-relaxed font-light">We've created a personalized property collection tailored to your preferences.</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleCollectionResponse(true)}
              className="w-full bg-white hover:bg-zinc-100 text-black font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] shadow-lg border border-zinc-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating your collection...
                </span>
              ) : (
                'Yes, keep me updated on new properties'
              )}
            </button>
            
            <button
              onClick={() => handleCollectionResponse(false)}
              className="w-full bg-transparent hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-300 font-medium py-4 px-8 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all duration-300"
              disabled={isLoading}
            >
              No thanks, just this visit
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg w-full bg-black/95 rounded-3xl shadow-2xl border border-zinc-800/60 backdrop-blur-lg">
      {/* Property Info Header */}
      <div className="p-6 bg-gradient-to-br from-zinc-800 to-black border-b border-zinc-700/50 rounded-t-3xl">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r from-zinc-700 via-zinc-800 to-black rounded-xl mb-3 border border-zinc-600/40">
            <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-1 tracking-tight font-light">EntryPoint™</h1>
          <p className="text-zinc-400 text-sm font-light">Open House Sign-in</p>
        </div>
        
        <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-700/40">
          <h2 className="text-lg font-semibold text-white mb-2 text-center font-light">{property.address}</h2>
          <div className="flex justify-center items-center flex-wrap gap-3 text-sm">
            <span className="bg-gradient-to-r from-zinc-600 to-zinc-700 text-white font-semibold px-3 py-1 rounded-full border border-zinc-600/40">
              {formatPrice(property.price)}
            </span>
            {property.beds && (
              <span className="bg-zinc-800/80 text-zinc-300 px-2 py-1 rounded-full flex items-center text-xs border border-zinc-700/40">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                </svg>
                {property.beds} beds
              </span>
            )}
            {property.baths && (
              <span className="bg-zinc-800/80 text-zinc-300 px-2 py-1 rounded-full flex items-center text-xs border border-zinc-700/40">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
                </svg>
                {property.baths} baths
              </span>
            )}
            {property.squareFeet && (
              <span className="bg-zinc-800/80 text-zinc-300 px-2 py-1 rounded-full flex items-center text-xs border border-zinc-700/40">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                </svg>
                {property.squareFeet.toLocaleString()} sqft
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight font-light">{getStepTitle()}</h3>
            <p className="text-zinc-400 text-sm mt-1 font-light">{getStepDescription()}</p>
          </div>
          <span className="text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-700/40">
            {currentStep} of 4
          </span>
        </div>
        
        <div className="relative">
          <div className="w-full bg-zinc-800/60 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-zinc-400 via-zinc-500 to-zinc-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  step <= currentStep 
                    ? 'bg-gradient-to-r from-zinc-400 to-zinc-600' 
                    : 'bg-zinc-700/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pb-6">
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">First Name*</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Last Name*</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Email Address*</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Phone Number*</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400/60 transition-all duration-300"
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Preferred Contact</label>
                <select
                  name="preferredContact"
                  value={formData.preferredContact}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                >
                  <option value="EMAIL">📧 Email</option>
                  <option value="PHONE">📞 Phone Call</option>
                  <option value="TEXT">💬 Text Message</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Visit Questions */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">What brings you here?</label>
                <select
                  name="visitingReason"
                  value={formData.visitingReason}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                  required
                >
                  <option value="">Choose reason...</option>
                  <option value="BUYING_SOON">🎯 Looking to buy soon</option>
                  <option value="BROWSING">👀 Just browsing</option>
                  <option value="NEIGHBORHOOD">📍 Interested in area</option>
                  <option value="INVESTMENT">💰 Investment opportunity</option>
                  <option value="CURIOUS">🤔 Curious about property</option>
                  <option value="OTHER">❓ Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">When to buy?</label>
                <select
                  name="timeframe"
                  value={formData.timeframe}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                  required
                >
                  <option value="">Select timeframe...</option>
                  <option value="IMMEDIATELY">🚀 Immediately</option>
                  <option value="1_3_MONTHS">📅 1-3 months</option>
                  <option value="3_6_MONTHS">📆 3-6 months</option>
                  <option value="6_12_MONTHS">🗓️ 6-12 months</option>
                  <option value="OVER_YEAR">⏳ Over a year</option>
                  <option value="NOT_SURE">🤷 Not sure yet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Price range?</label>
                <select
                  name="priceRange"
                  value={formData.priceRange}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300"
                >
                  <option value="">Select budget...</option>
                  <option value="UNDER_500K">💸 Under $500K</option>
                  <option value="500K_750K">💰 $500K - $750K</option>
                  <option value="750K_1M">💎 $750K - $1M</option>
                  <option value="1M_1_5M">💍 $1M - $1.5M</option>
                  <option value="1_5M_2M">👑 $1.5M - $2M</option>
                  <option value="OVER_2M">🏰 Over $2M</option>
                  <option value="FLEXIBLE">🔄 Flexible</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Final Question */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-zinc-900/30 to-black/30 rounded-xl p-3 border border-zinc-700/30 text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-zinc-600 to-zinc-700 rounded-full mb-2 border border-zinc-600/40">
                  <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h4 className="text-base font-bold text-white mb-1 font-light">Almost done!</h4>
                <p className="text-zinc-300 text-xs font-light">Ready to create your collection.</p>
              </div>

              <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-700/40">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-zinc-400">Name:</div>
                  <div className="text-white font-medium">{formData.firstName} {formData.lastName}</div>
                  <div className="text-zinc-400">Contact:</div>
                  <div className="text-white font-medium">{formData.preferredContact.toLowerCase()}</div>
                  <div className="text-zinc-400">Timeframe:</div>
                  <div className="text-white font-medium">{formData.timeframe.replace('_', '-') || 'Not specified'}</div>
                  <div className="text-zinc-400">Budget:</div>
                  <div className="text-white font-medium">{formData.priceRange.replace('_', '-') || 'Flexible'}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Features? (Optional)</label>
                <textarea
                  name="additionalComments"
                  value={formData.additionalComments}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-zinc-900/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/60 focus:border-zinc-400/60 transition-all duration-300 text-sm"
                  rows={2}
                  placeholder="pool, garage, modern kitchen..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 pt-4">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium py-3 px-6 rounded-xl border border-zinc-700/50 hover:border-zinc-600 transition-all duration-300"
            >
              ← Back
            </button>
          )}
          
          <button
            type={currentStep === 4 ? "submit" : "button"}
            onClick={currentStep === 4 ? undefined : handleNextStep}
            className={`${currentStep > 1 ? 'flex-1' : 'w-full'} bg-white hover:bg-zinc-100 text-black font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.01] border border-zinc-200`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                {currentStep === 4 ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Complete
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </>
                )}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}