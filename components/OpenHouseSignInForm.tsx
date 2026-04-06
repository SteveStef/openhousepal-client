'use client'

import { useState } from 'react'
import Image from 'next/image'
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
    priceRange: '',
    interestedInSimilar: false,
    additionalComments: '',
    fullName: '',
    hasAgent: ''
  })

  const [currentStep, setCurrentStep] = useState(1)
  const [showCollectionOffer, setShowCollectionOffer] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    // Clear error when user types
    if (name === 'email') {
      setEmailError(null)
    }
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailBlur = () => {
    if (formData.email && !validateEmail(formData.email)) {
      setEmailError('Please enter a valid email address')
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Strip all non-numeric characters
    const phoneNumber = value.replace(/\D/g, '')

    // Limit to 10 digits
    const trimmed = phoneNumber.slice(0, 10)

    // Format as (XXX) XXX-XXXX
    if (trimmed.length < 4) return trimmed
    if (trimmed.length < 7) return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`
    return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData(prev => ({
      ...prev,
      phone: formatted
    }))
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName.trim() !== ''
      case 2:
        return formData.email.trim() !== '' && validateEmail(formData.email) && formData.phone.trim() !== ''
      case 3:
        return formData.hasAgent !== ''
      default:
        return false
    }
  }

  const handleNextStep = () => {
    if (!isStepValid()) {
      return // Don't advance if validation fails
    }
    if (currentStep < 3) {
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

    if (currentStep < 3) {
      // If not on the final step, just move to next step
      handleNextStep()
      return
    }

    if (currentStep === 3) {
      // If user already has an agent, skip collection offer and submit directly
      if (formData.hasAgent === 'YES') {
        const finalData = { ...formData, interestedInSimilar: false }
        await onSubmit(finalData)
        return
      }

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
      default: return "Sign In"
    }
  }

  if (showCollectionOffer) {
    return (
      <div className="max-w-lg mx-auto bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="p-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-[#0B0B0B] dark:text-white mb-4 tracking-tight">Thank You!</h2>
            <p className="text-[#6B7280] dark:text-gray-400 text-lg font-medium leading-relaxed">Would you like automated updates on similar properties in this area?</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleCollectionResponse(true)}
              className="w-full bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] dark:hover:text-white font-black uppercase tracking-widest py-4 px-8 rounded-2xl transition-all duration-300 shadow-xl hover:scale-[1.02] active:scale-95"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white dark:text-[#111827]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              className="w-full bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-[#6B7280] dark:text-gray-400 font-bold py-4 px-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 transition-all duration-300 uppercase tracking-widest text-xs"
              disabled={isLoading}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    )
  }

  const the_image_src = property.ListPictureURL || "";

  return (
    <div className="max-w-lg w-full bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors duration-300">
      {/* Property Info Header */}
      <div className="p-6 bg-[#FAFAF7] dark:bg-[#1A1A1C] border-b border-gray-100 dark:border-gray-800">
        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase relative inline-block">
            Guest Sign-in
            <span className="absolute -bottom-2 left-0 right-0 h-1 bg-[#C9A24D] rounded-full opacity-30"></span>
          </h1>
        </div>

        <div className="bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex shadow-sm">
          {/* Property Image */}
          {the_image_src && (
            <div className="w-32 h-32 flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative">
              <Image
                src={the_image_src}
                alt={property.FullStreetAddress}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Property Details */}
          <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
            <h2 className="text-sm font-black text-[#0B0B0B] dark:text-white mb-2 leading-tight truncate">
              {property.FullStreetAddress}
            </h2>

            <div className="space-y-3">
              <div>
                <span className="text-base font-black text-[#C9A24D] tracking-tight">
                  {formatPrice(property.ListPrice)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-gray-400">
                {property.BedroomsTotal && (
                  <span className="flex items-center">
                    <span className="text-[#111827] dark:text-white mr-1">{property.BedroomsTotal}</span> Beds
                  </span>
                )}
                <span className="text-gray-200 dark:text-gray-700">•</span>
                {property.BathroomsTotal && (
                  <span className="flex items-center">
                    <span className="text-[#111827] dark:text-white mr-1">{property.BathroomsTotal}</span> Baths
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">{getStepTitle()}</h3>
          <span className="text-[10px] font-black text-[#6B7280] dark:text-gray-400 bg-[#FAFAF7] dark:bg-[#1A1A1C] px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800 uppercase tracking-widest">
            {currentStep} of 3
          </span>
        </div>
        
        <div className="relative">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
            <div 
              className="bg-[#C9A24D] h-full rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-8 pb-8">
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name*</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address*</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleEmailBlur}
                  className={`w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 transition-all ${
                    emailError 
                      ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500' 
                      : 'border-gray-200 dark:border-gray-700 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D]'
                  }`}
                  placeholder="name@example.com"
                  required
                />
                {emailError && (
                  <p className="mt-2 text-xs text-red-500 font-bold ml-1 animate-fadeIn">{emailError}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone Number*</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white font-medium focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all"
                  placeholder="(555) 000-0000"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Agent Question */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn text-center">
              <div className="bg-[#FAFAF7] dark:bg-[#1A1A1C] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2">Agent Representation</h4>
                <p className="text-[#0B0B0B] dark:text-white text-base font-bold">Do you have an active agreement with a real estate agent?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, hasAgent: 'NO' }))}
                  className={`py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                    formData.hasAgent === 'NO'
                      ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#111827] dark:border-white shadow-xl'
                      : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[#C9A24D]'
                  }`}
                >
                  No
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, hasAgent: 'YES' }))}
                  className={`py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                    formData.hasAgent === 'YES'
                      ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#111827] dark:border-white shadow-xl'
                      : 'bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[#C9A24D]'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-4 pt-8">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-[#6B7280] dark:text-gray-400 font-black uppercase tracking-widest py-4 px-6 rounded-2xl border-2 border-gray-100 dark:border-gray-800 transition-all text-xs"
            >
              Back
            </button>
          )}
          
          <button
            type={currentStep === 3 ? "submit" : "button"}
            onClick={currentStep === 3 ? undefined : handleNextStep}
            className={`${currentStep > 1 ? 'flex-1' : 'w-full'} bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] dark:hover:text-white font-black uppercase tracking-widest py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] text-xs`}
            disabled={isLoading || !isStepValid()}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white dark:text-[#111827]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                {currentStep === 3 ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Complete
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path>
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
