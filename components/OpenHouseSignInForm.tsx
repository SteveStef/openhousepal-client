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
    timeframe: '',
    priceRange: '',
    interestedInSimilar: false,
    additionalComments: '',
    fullName: '',
    hasAgent: ''
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
    
    if (currentStep < 4) {
      // If not on the final step, just move to next step
      handleNextStep()
      return
    }
    
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
      case 1: return "Welcome!"
      case 2: return "Contact Info"
      case 3: return "Your Visit"
      case 4: return "Almost Done"
      default: return "Sign In"
    }
  }

  if (showCollectionOffer) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl border border-gray-200">
        <div className="p-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h2>
            <p className="text-gray-600 text-base">Would you like updates on similar properties?</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleCollectionResponse(true)}
              className="w-full bg-[#8b7355] hover:bg-[#7a6549] text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Yes, keep me updated'
              )}
            </button>
            
            <button
              onClick={() => handleCollectionResponse(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-4 px-8 rounded-2xl border border-gray-200 transition-all duration-300"
              disabled={isLoading}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-gray-200">
      {/* Property Info Header */}
      <div className="p-6 bg-gradient-to-br from-[#faf9f7] to-[#f5f4f2] border-b border-gray-200 rounded-t-3xl">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[#8b7355] rounded-xl mb-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Open House Sign-in</h1>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 text-center">{property.address}</h2>
          <div className="flex justify-center items-center flex-wrap gap-3 text-sm">
            <span className="bg-[#8b7355] text-white font-semibold px-3 py-1 rounded-full">
              {formatPrice(property.price)}
            </span>
            {property.beds && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center text-xs">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                </svg>
                {property.beds} beds
              </span>
            )}
            {property.baths && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center text-xs">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
                </svg>
                {property.baths} baths
              </span>
            )}
            {/*{property.squareFeet && Number(property.squareFeet) > 0 && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center text-xs">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                </svg>
                {property.squareFeet.toLocaleString()} sqft
              </span>
            )}*/}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{getStepTitle()}</h3>
          </div>
          <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            {currentStep} of 4
          </span>
        </div>
        
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#8b7355] h-full rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pb-6">
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name*</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email*</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone*</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Visit Questions */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What's your timeline?</label>
                <select
                  name="timeframe"
                  value={formData.timeframe}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  required
                >
                  <option value="">Select timeframe...</option>
                  <option value="IMMEDIATELY">Immediately</option>
                  <option value="1_3_MONTHS">1-3 months</option>
                  <option value="3_6_MONTHS">3-6 months</option>
                  <option value="6_12_MONTHS">6-12 months</option>
                  <option value="OVER_YEAR">Over a year</option>
                  <option value="NOT_SURE">Not sure</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Do you have a real estate agent?</label>
                <select
                  name="hasAgent"
                  value={formData.hasAgent}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  required
                >
                  <option value="">Select...</option>
                  <option value="YES">Yes, I have an agent</option>
                  <option value="NO">No, I don't have an agent</option>
                  <option value="LOOKING">I'm looking for an agent</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Final Question */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <h4 className="text-base font-bold text-gray-900 mb-1">Almost done!</h4>
                <p className="text-gray-600 text-sm">Any special features you're looking for?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Features (Optional)</label>
                <textarea
                  name="additionalComments"
                  value={formData.additionalComments}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  rows={3}
                  placeholder="pool, garage, modern kitchen..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 pt-6">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-300"
            >
              ← Back
            </button>
          )}
          
          <button
            type={currentStep === 4 ? "submit" : "button"}
            onClick={currentStep === 4 ? undefined : handleNextStep}
            className={`${currentStep > 1 ? 'flex-1' : 'w-full'} bg-[#8b7355] hover:bg-[#7a6549] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
