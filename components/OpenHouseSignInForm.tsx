'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Property, SignInFormData } from '@/types'

// Plain opacity + x slide, one tween for both - no `scale` (an extra property fighting for the
// same frames as the slide) and no spring (its duration varies with velocity, which is what was
// reading as "not smooth" on iPad: dropped frames make a spring visibly stutter in a way a fixed
// tween doesn't). Deliberately no `layout` prop on the step either - combined with
// mode="popLayout" it FLIPs (measures DOM rects before/after) on every step change, which is
// exactly the kind of layout thrashing Safari on iPad handles worst; letting the container just
// reflow to the next step's height while it slides in reads as smoother, not less finished.
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
}
const stepTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }

interface OpenHouseSignInFormProps {
  property: Property;
  onSubmit: (formData: SignInFormData) => Promise<void>;
  isLoading?: boolean;
  // Overrides the "Guest Sign-in" header - used for the "scan to see more like this" entry
  // point (reached from a Similar Properties handout, not the open house sign-in sheet/QR),
  // which reuses this exact same form/flow but isn't framed as signing in to anything.
  headline?: string;
}

export default function OpenHouseSignInForm({
  property,
  onSubmit,
  isLoading = false,
  headline = 'Guest Sign-in',
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

  // Step 1 collects every typed field (name, email, phone) together - on a tablet/kiosk the
  // on-screen keyboard stays up for the whole step instead of popping open and closed between
  // separate name/email/phone screens. Steps 2 and 3 are tap-only Yes/No questions, so they
  // don't need the keyboard at all.
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState(1)
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

  // "Do you have an agent?" - the final step either way now. Yes submits with no showcase
  // (compliance: someone already represented shouldn't be offered further follow-up). No submits
  // immediately too - anyone without an agent automatically gets a showcase and a follow-up
  // email, the same as every other sign-in path (QR code, sign-in sheet); there's no separate
  // opt-in question for it anymore.
  const handleAgentResponse = async (value: 'YES' | 'NO') => {
    if (isLoading) return;

    setFormData(prev => ({ ...prev, hasAgent: value }));
    await onSubmit({ ...formData, hasAgent: value, interestedInSimilar: value === 'NO' });
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName.trim() !== '' && formData.email.trim() !== '' && validateEmail(formData.email) && formData.phone.trim() !== ''
      case 2:
        return formData.hasAgent !== ''
      default:
        return false
    }
  }

  const handleNextStep = () => {
    if (!isStepValid()) {
      return // Don't advance if validation fails
    }
    if (currentStep === 1) {
      setDirection(1)
      setCurrentStep(2)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setDirection(-1)
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (currentStep === 1) {
      // Not on a final step yet - just move on to the agent question.
      handleNextStep()
      return
    }

    // Step 2 is handled entirely by its own Yes/No buttons.
  }

  const formatPrice = (price?: number) => {
    return price ? `$${price.toLocaleString()}` : 'Price Available Upon Request'
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Your Info"
      case 2: return "Your Visit"
      default: return "Sign In"
    }
  }

  const the_image_src = property.ListPictureURL || "";

  return (
    <div className="max-w-lg w-full bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors duration-300">
      {/* Property Info Header */}
      <div className="p-6 bg-[#FAFAF7] dark:bg-[#1A1A1C] border-b border-gray-100 dark:border-gray-800">
        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase relative inline-block">
            {headline}
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
                sizes="256px"
                quality={90}
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
            {currentStep} of 2
          </span>
        </div>

        <div className="relative">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
            <div
              className="bg-[#C9A24D] h-full rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 2) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-8 pb-8">
        {/* This wrapper (not the individual steps) owns the height animation: it never
            unmounts, so framer-motion can FLIP its actual before/after rect as step 1's tall
            inputs give way to step 2's short Yes/No card - the buttons below it then get
            carried along smoothly (see `layout` on that row) instead of the whole thing
            snapping straight to the new height, which was reading as a glitchy resize. */}
        <motion.div layout transition={stepTransition} className="flex-1 flex flex-col justify-center space-y-6 overflow-hidden">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          {/* Step 1: Name, Email & Phone - everything the keyboard is needed for, all at once */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
              className="space-y-4">
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
            </motion.div>
          )}

          {/* Step 2: Agent Question */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
              className="space-y-6 text-center">
              <div className="bg-[#FAFAF7] dark:bg-[#1A1A1C] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2">Agent Representation</h4>
                <p className="text-[#0B0B0B] dark:text-white text-base font-bold">Do you have an active agreement with a real estate agent?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleAgentResponse('NO')}
                  disabled={isLoading}
                  className={`py-6 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[#C9A24D] hover:text-[#C9A24D] active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading && formData.hasAgent === 'NO' ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#6B7280] dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : 'No'}
                </button>

                <button
                  type="button"
                  onClick={() => handleAgentResponse('YES')}
                  disabled={isLoading}
                  className={`py-6 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 bg-white dark:bg-[#0B0B0B] border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:border-[#C9A24D] hover:text-[#C9A24D] active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading && formData.hasAgent === 'YES' ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#111827] dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : 'Yes'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>

        <motion.div layout transition={stepTransition} className="flex space-x-4 pt-8">
          {currentStep === 2 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-[#6B7280] dark:text-gray-400 font-black uppercase tracking-widest py-4 px-6 rounded-2xl border-2 border-gray-100 dark:border-gray-800 transition-all text-xs"
            >
              Back
            </button>
          )}

          {currentStep === 1 && (
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] dark:hover:text-white font-black uppercase tracking-widest py-4 px-6 rounded-2xl transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] text-xs"
              disabled={isLoading || !isStepValid()}
            >
              <span className="flex items-center justify-center">
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path>
                </svg>
              </span>
            </button>
          )}
        </motion.div>
      </form>
    </div>
  )
}
