'use client'

import AuthLuxeStyle, { AuthKicker, AuthPhoneHeader, GoldPal } from '@/components/auth/AuthLuxeStyle'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { AUTH_FEATURE_SLIDES } from '@/lib/authFeatureSlides'
import PageBackgroundGrid from '@/components/PageBackgroundGrid'
import { QrBadge } from '@/components/home/LineArtMotifs'
import EmailVerificationInput from '../../../components/EmailVerificationInput'
import BrokerageAutocomplete from '../../../components/BrokerageAutocomplete'
import api from '@/lib/api-service'
import { TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
]

// ---- Phone sign-up flow (under md) ------------------------------------------------------------
// Phones get the same form as a short step-by-step flow: 1 which MLS, 2 name + email, 3 MLS ID or
// license + state + brokerage, 4 password + terms -> Create Account, 5 the 6-digit email code.
// Same form state and the same handleSubmit as the desktop page; desktop is untouched.
const PHONE_STEP_COUNT = 5
const PHONE_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', email: 'Email', mlsId: 'MLS ID',
  licenseNumber: 'License number', state: 'State', brokerage: 'Brokerage', password: 'Password',
  confirmPassword: 'Confirm password', agreeToTerms: 'Terms checkbox',
}
function phoneStepFields(step: number, bright: boolean): string[] {
  if (step === 2) return ['firstName', 'lastName', 'email']
  if (step === 3) return [bright ? 'mlsId' : 'licenseNumber', 'state', 'brokerage']
  if (step === 4) return ['password', 'confirmPassword', 'agreeToTerms']
  return []
}
// The earliest step holding one of these field errors (0 = none of them are on a step).
function phoneStepForErrors(errs: { [key: string]: string }): number {
  for (const step of [2, 3, 4]) {
    if ([...phoneStepFields(step, true), ...phoneStepFields(step, false)].some(f => errs[f])) return step
  }
  return 0
}
const phoneLabelCls = 'mb-1.5 ml-1 block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-gray-400'
const phoneInputCls = (err?: string) =>
  `block w-full rounded-xl border px-4 py-3 text-base font-medium text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-colors focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] focus:bg-white dark:focus:bg-[#111827] ${
    err ? 'border-red-300 dark:border-red-500/60 bg-red-50/40 dark:bg-red-500/5' : 'border-gray-200 dark:border-gray-700 bg-[#FAFAF7] dark:bg-[#0B0B0B]'
  }`
function PhoneFieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 pl-1 text-xs font-semibold text-red-500 dark:text-red-400">{msg}</p>
}

export default function RegisterPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mlsId: '',
    licenseNumber: '',
    state: '',
    brokerage: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | null,
    message: string
  }>({ type: null, message: '' })
  const [isBrokerageValid, setIsBrokerageValid] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({})
  const [showPassword, setShowPassword] = useState(false)
  
  const [currentSlide, setCurrentSlide] = useState(0)

  // Shared with the sign-in screen - see lib/authFeatureSlides.tsx.
  const slides = AUTH_FEATURE_SLIDES

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  // Drives the corner motif's one-time stroke draw-in (see components/home/LineArtMotifs.tsx) -
  // a short delay after mount so it plays as a visible animation instead of appearing pre-drawn.
  const [motifVisible, setMotifVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMotifVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  const [registrationStep, setRegistrationStep] = useState<'form' | 'verify'>('form')

  // Bright MLS agents vs everyone else. Agents outside Bright give a license number instead of an
  // MLS ID, type their brokerage, skip the Bright approval step and see the No-MLS plans.
  // Arriving from a No-MLS plan card (?plan=no_mls / pro_no_mls) starts on that side.
  const [audience, setAudience] = useState<'bright' | 'other'>('bright')
  const isBright = audience === 'bright'
  // An admin test-account link (/register?code=...): lets the Bright sign-up take the MLS ID of the
  // agent the code copies. Only sent with a Bright sign-up.
  const [signupCode, setSignupCode] = useState('')
  useEffect(() => {
    const code = (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase()
    if (code) setSignupCode(code)
  }, [])
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('plan') || ''
    if (plan) { try { localStorage.setItem('ohp_signup_plan', plan) } catch {} }
    if (plan === 'no_mls' || plan === 'pro_no_mls') setAudience('other')
  }, [])
  const switchAudience = (a: 'bright' | 'other') => {
    setAudience(a)
    setFieldErrors(prev => ({ ...prev, mlsId: '', licenseNumber: '', brokerage: '' }))
  }

  // Phone flow state (see the PHONE_* helpers above). phoneFocusTick asks the flow to scroll to and
  // focus the first field with an error; phoneNotice is a server error with no field to sit on.
  const [phoneStep, setPhoneStep] = useState(1)
  const [phoneFocusTick, setPhoneFocusTick] = useState(0)
  const [phoneNotice, setPhoneNotice] = useState('')
  const phoneMainRef = useRef<HTMLDivElement>(null)
  const showPhoneErrors = (errs: { [key: string]: string }) => {
    const step = phoneStepForErrors(errs)
    if (step) setPhoneStep(step)
    setPhoneFocusTick(t => t + 1)
  }

  // Clear notifications after 5 seconds
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
    if (!formData.state.trim()) newErrors.state = 'State is required'
    if (!formData.brokerage.trim()) {
      newErrors.brokerage = 'Brokerage is required'
    } else if (isBright && !isBrokerageValid) {
      newErrors.brokerage = 'Please select a brokerage from the dropdown options'
    }
    if (isBright && !formData.mlsId.trim()) newErrors.mlsId = 'MLS ID is required'
    if (!isBright && !formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required'
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    
    return newErrors
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrors({})
    setFieldErrors({})
    setNotification({ type: null, message: '' })
    setPhoneNotice('')

    // Validate form
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      showPhoneErrors(validationErrors)
      showNotification('error', 'Please correct the errors below')
      return
    }

    // Send verification code
    setIsLoading(true)

    const { success, error } = await api.auth.sendVerificationCode({
      email: formData.email,
      first_name: formData.firstName,
      last_name: formData.lastName,
      state: formData.state,
      brokerage: formData.brokerage,
      password: formData.password,
      is_bright: isBright,
      ...(isBright ? { mls_id: formData.mlsId, ...(signupCode ? { signup_code: signupCode } : {}) } : { license_number: formData.licenseNumber.trim() }),
    })

    if (success) {
      setIsLoading(false)
      setRegistrationStep('verify')
      showNotification('success', 'Verification code sent to your email!')
    } else {
      const errorMessage = error || 'Failed to send verification code. Please try again.'
      const newFieldErrors: {[key: string]: string} = {}
      const lowerError = errorMessage.toLowerCase()
      
      if (lowerError.includes('email') && lowerError.includes('registered')) {
        newFieldErrors.email = errorMessage
      } else if (lowerError.includes('mls id')) {
        newFieldErrors.mlsId = errorMessage
      } else if (lowerError.includes('license')) {
        newFieldErrors.licenseNumber = errorMessage
      }

      if (Object.keys(newFieldErrors).length > 0) {
        setFieldErrors(newFieldErrors)
        showPhoneErrors(newFieldErrors)
        showNotification('error', 'Please correct the errors in the form')
      } else {
        setPhoneNotice(errorMessage)
        showNotification('error', errorMessage)
      }
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({
        ...fieldErrors,
        [name]: ''
      })
    }
    
    // Clear general errors and notifications when user interacts
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
    if (phoneNotice) setPhoneNotice('')
  }

  // ---- Phone flow behaviour ----
  const phoneDisplayStep = registrationStep === 'verify' ? PHONE_STEP_COUNT : phoneStep
  const phoneStepLabel = ['Your MLS', 'About you', isBright ? 'Your MLS ID' : 'Your license', 'Password', 'Verify email'][phoneDisplayStep - 1]

  // Continue on steps 1-3: check just this step's fields; errors show on the field and by the button.
  const phoneContinue = (e?: React.FormEvent) => {
    e?.preventDefault()
    setPhoneNotice('')
    const all = validateForm()
    const errs: { [key: string]: string } = {}
    for (const f of phoneStepFields(phoneStep, isBright)) if (all[f]) errs[f] = all[f]
    if (Object.keys(errs).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...errs }))
      setPhoneFocusTick(t => t + 1)
      return
    }
    setPhoneStep(s => Math.min(4, s + 1))
  }
  const phoneBack = () => {
    setPhoneNotice('')
    setPhoneStep(s => Math.max(1, s - 1))
  }

  // New step: start at its top.
  useEffect(() => {
    phoneMainRef.current?.scrollTo({ top: 0 })
  }, [phoneDisplayStep])

  // Scroll to + focus the first field with an error on the current phone step (phones only).
  useEffect(() => {
    if (!phoneFocusTick || window.matchMedia('(min-width: 768px)').matches) return
    const raf = requestAnimationFrame(() => {
      const f = phoneStepFields(phoneStep, isBright).find(k => fieldErrors[k])
      if (!f) return
      const wrap = document.getElementById(`m-field-${f}`)
      const input = (document.getElementById(`m-${f}`) || wrap?.querySelector('input, select')) as HTMLElement | null
      wrap?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      input?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneFocusTick])

  // What sits right above the Back / Continue buttons: this step's field errors, else a server error.
  const phoneStepErrs = registrationStep === 'verify' ? [] : phoneStepFields(phoneStep, isBright).filter(f => fieldErrors[f])
  const phoneFooterError = phoneStepErrs.length === 1
    ? fieldErrors[phoneStepErrs[0]]
    : phoneStepErrs.length > 1
      ? `Fix ${phoneStepErrs.length} fields to continue: ${phoneStepErrs.map(f => PHONE_FIELD_LABELS[f]).join(', ')}.`
      : phoneNotice

  const verifyScreen = (
    <EmailVerificationInput
      email={formData.email}
      onVerified={async () => {
        // Backend now creates user and returns token during verify-code
        // Refresh local auth state to reflect the new account
        await refreshUser()
        // Outside Bright there's no data feed to approve - straight to picking a plan.
        router.push(isBright ? '/broker-authorization' : '/checkout')
      }}
      onBack={() => {
        setRegistrationStep('form')
        setNotification({ type: null, message: '' })
        // Phone flow: "Wrong email? Go back" lands on the email step.
        setPhoneStep(2)
      }}
    />
  )

  return (
    <>
    {/* ---- Phones (under md): step-by-step sign-up ---- */}
    <div className="md:hidden flex h-screen supports-[height:100dvh]:h-[100dvh] flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      <AuthLuxeStyle />
      <AuthPhoneHeader linkHref="/login" linkLabel="Sign in" prompt="Have an account?" />

      {/* Progress */}
      <div className="shrink-0 px-5 pt-3 pb-2">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
          <span className="text-[#8b7355] dark:text-[#e8c97a]">Step {phoneDisplayStep} of {PHONE_STEP_COUNT}</span>
          <span className="text-[#6B7280] dark:text-gray-400">{phoneStepLabel}</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={PHONE_STEP_COUNT} aria-valuenow={phoneDisplayStep}>
          {Array.from({ length: PHONE_STEP_COUNT }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-colors duration-300 ${i < phoneDisplayStep ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-800'}`} />
          ))}
        </div>
      </div>

      {/* The step itself - scrolls on its own so the buttons below never move or get cut off */}
      <div ref={phoneMainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-8">
        {registrationStep === 'verify' ? (
          <div className="pt-2">{verifyScreen}</div>
        ) : (
          <form id="m-signup" method="post" noValidate onSubmit={(e) => (phoneStep === 4 ? handleSubmit(e) : phoneContinue(e))}>
            {/* 1 - Which MLS */}
            <section className={phoneStep === 1 ? '' : 'hidden'} aria-hidden={phoneStep !== 1}>
              <div className="mb-5 text-center">
                <AuthKicker>Start free</AuthKicker>
                <h2 className="mb-1 font-serif text-[34px] leading-tight font-black tracking-[-0.02em] text-[#0B0B0B] dark:text-white">Create <em className="ohp-home-em">Account.</em></h2>
                <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400">Start your {TRIAL_PERIOD_DAYS}-day free trial today.</p>
              </div>
              <p className={phoneLabelCls}>Which MLS are you in?</p>
              <div role="radiogroup" aria-label="Which MLS are you in?" className="space-y-3">
                {([
                  ['bright', 'Bright MLS agent', 'Sign up with your Bright MLS ID.'],
                  ['other', 'Not in Bright MLS', "No MLS data needed - you'll get the No-MLS plans and can start right away."],
                ] as const).map(([id, label, sub]) => {
                  const on = audience === id
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} onClick={() => switchAudience(id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${on
                        ? 'border-[#C9A24D] bg-white dark:bg-[#151517] shadow-[0_18px_40px_-28px_rgba(139,115,85,.8)]'
                        : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-[#111113]'}`}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D]' : 'border-gray-300 dark:border-gray-600'}`}>
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-[#C9A24D]" />}
                      </span>
                      <span>
                        <span className="block text-base font-bold text-[#111827] dark:text-white">{label}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug font-medium text-[#6B7280] dark:text-gray-400">{sub}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 2 - Name + email */}
            <section className={phoneStep === 2 ? '' : 'hidden'} aria-hidden={phoneStep !== 2}>
              <div className="mb-5">
                <h2 className="font-serif text-[30px] leading-tight font-black tracking-[-0.02em] text-[#0B0B0B] dark:text-white">About <em className="ohp-home-em">you.</em></h2>
                <p className="mt-1 text-sm font-medium text-[#6B7280] dark:text-gray-400">Your name and the email you&apos;ll sign in with.</p>
              </div>
              <div className="space-y-4">
                <div id="m-field-firstName">
                  <label htmlFor="m-firstName" className={phoneLabelCls}>First name</label>
                  <input id="m-firstName" name="firstName" type="text" autoComplete="given-name" enterKeyHint="next"
                    value={formData.firstName} onChange={handleChange} className={phoneInputCls(fieldErrors.firstName)} placeholder="John" />
                  <PhoneFieldError msg={fieldErrors.firstName} />
                </div>
                <div id="m-field-lastName">
                  <label htmlFor="m-lastName" className={phoneLabelCls}>Last name</label>
                  <input id="m-lastName" name="lastName" type="text" autoComplete="family-name" enterKeyHint="next"
                    value={formData.lastName} onChange={handleChange} className={phoneInputCls(fieldErrors.lastName)} placeholder="Smith" />
                  <PhoneFieldError msg={fieldErrors.lastName} />
                </div>
                <div id="m-field-email">
                  <label htmlFor="m-email" className={phoneLabelCls}>Email address</label>
                  <input id="m-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" enterKeyHint="next"
                    value={formData.email} onChange={handleChange} className={phoneInputCls(fieldErrors.email)} placeholder="john.smith@example.com" />
                  <PhoneFieldError msg={fieldErrors.email} />
                </div>
              </div>
            </section>

            {/* 3 - MLS ID or license, state, brokerage */}
            <section className={phoneStep === 3 ? '' : 'hidden'} aria-hidden={phoneStep !== 3}>
              <div className="mb-5">
                <h2 className="font-serif text-[30px] leading-tight font-black tracking-[-0.02em] text-[#0B0B0B] dark:text-white">
                  Your <em className="ohp-home-em">{isBright ? 'MLS.' : 'license.'}</em>
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6B7280] dark:text-gray-400">
                  {isBright ? 'Your Bright MLS ID, state and brokerage.' : 'Your license number, state and brokerage.'}
                </p>
              </div>
              <div className="space-y-4">
                {isBright ? (
                  <div id="m-field-mlsId">
                    <label htmlFor="m-mlsId" className={phoneLabelCls}>MLS ID</label>
                    <input id="m-mlsId" name="mlsId" type="text" inputMode="numeric" autoComplete="off" enterKeyHint="next"
                      value={formData.mlsId}
                      onChange={(e) => { if (/^\d*$/.test(e.target.value)) handleChange(e) }}
                      className={phoneInputCls(fieldErrors.mlsId)} placeholder="1234567" />
                    <PhoneFieldError msg={fieldErrors.mlsId} />
                    {signupCode && <p className="mt-1.5 pl-1 text-xs font-semibold text-[#8b7355] dark:text-[#d7b974]">Test account code {signupCode} applied</p>}
                  </div>
                ) : (
                  <div id="m-field-licenseNumber">
                    <label htmlFor="m-licenseNumber" className={phoneLabelCls}>License number</label>
                    <input id="m-licenseNumber" name="licenseNumber" type="text" maxLength={40} autoComplete="off" autoCapitalize="characters" enterKeyHint="next"
                      value={formData.licenseNumber} onChange={handleChange} className={phoneInputCls(fieldErrors.licenseNumber)} placeholder="e.g. RS123456" />
                    <PhoneFieldError msg={fieldErrors.licenseNumber} />
                  </div>
                )}
                <div id="m-field-state">
                  <label htmlFor="m-state" className={phoneLabelCls}>State</label>
                  <div className="relative">
                    <select id="m-state" name="state" value={formData.state} onChange={(e: any) => handleChange(e)}
                      className={`${phoneInputCls(fieldErrors.state)} appearance-none pr-10`}>
                      <option value="" disabled>Select state</option>
                      {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <PhoneFieldError msg={fieldErrors.state} />
                </div>
                {/* Bright: on focus, lift the field to the top so the pick-list below has room
                    (the extra bottom padding lets it scroll that far). */}
                <div id="m-field-brokerage" className={isBright ? 'scroll-mt-2 pb-56' : ''}
                  onFocusCapture={isBright ? (e) => {
                    const el = e.currentTarget
                    setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
                  } : undefined}>
                  <label htmlFor={isBright ? undefined : 'm-brokerage'} className={phoneLabelCls}>Brokerage</label>
                  {isBright ? (
                    <BrokerageAutocomplete
                      value={formData.brokerage}
                      onChange={(val) => {
                        setFormData(prev => ({ ...prev, brokerage: val }))
                        if (fieldErrors.brokerage) setFieldErrors(prev => ({ ...prev, brokerage: '' }))
                      }}
                      onValidationChange={setIsBrokerageValid}
                      error={!!fieldErrors.brokerage}
                      placeholder="Start typing, e.g. Re/Max..."
                    />
                  ) : (
                    <input id="m-brokerage" name="brokerage" type="text" maxLength={120} autoComplete="organization" enterKeyHint="next"
                      value={formData.brokerage} onChange={handleChange} className={phoneInputCls(fieldErrors.brokerage)} placeholder="Your brokerage" />
                  )}
                  <PhoneFieldError msg={fieldErrors.brokerage} />
                  {isBright && !fieldErrors.brokerage && (
                    <p className="mt-1.5 pl-1 text-xs font-medium text-[#6B7280] dark:text-gray-400">Pick your brokerage from the list as you type.</p>
                  )}
                </div>
              </div>
            </section>

            {/* 4 - Password + terms */}
            <section className={phoneStep === 4 ? '' : 'hidden'} aria-hidden={phoneStep !== 4}>
              <div className="mb-5">
                <h2 className="font-serif text-[30px] leading-tight font-black tracking-[-0.02em] text-[#0B0B0B] dark:text-white">Set a <em className="ohp-home-em">password.</em></h2>
                <p className="mt-1 text-sm font-medium text-[#6B7280] dark:text-gray-400">At least 8 characters. Then we&apos;ll email you a code.</p>
              </div>
              <div className="space-y-4">
                <div id="m-field-password">
                  <label htmlFor="m-password" className={phoneLabelCls}>Password</label>
                  <div className="relative">
                    <input id="m-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="next"
                      value={formData.password} onChange={handleChange} className={`${phoneInputCls(fieldErrors.password)} pr-12`} placeholder="Strong password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-[#111827] dark:hover:text-white">
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <PhoneFieldError msg={fieldErrors.password} />
                </div>
                <div id="m-field-confirmPassword">
                  <label htmlFor="m-confirmPassword" className={phoneLabelCls}>Confirm password</label>
                  <input id="m-confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="done"
                    value={formData.confirmPassword} onChange={handleChange} className={phoneInputCls(fieldErrors.confirmPassword)} placeholder="Confirm password" />
                  <PhoneFieldError msg={fieldErrors.confirmPassword} />
                </div>
                <div id="m-field-agreeToTerms">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${fieldErrors.agreeToTerms ? 'border-red-300 dark:border-red-500/60 bg-red-50/40 dark:bg-red-500/5' : 'border-transparent'}`}>
                    <span className="relative mt-0.5 shrink-0">
                      <input id="m-agreeToTerms" type="checkbox" name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} className="peer sr-only" />
                      <span className={`block h-6 w-6 rounded-md border-2 transition-colors peer-checked:border-[#111827] peer-checked:bg-[#111827] dark:peer-checked:border-[#C9A24D] dark:peer-checked:bg-[#C9A24D] peer-focus-visible:ring-4 peer-focus-visible:ring-[#C9A24D]/30 ${fieldErrors.agreeToTerms ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
                      <svg className="pointer-events-none absolute left-1 top-1 h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100 dark:text-[#111827]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-[#6B7280] dark:text-gray-400">
                      I agree to the{' '}
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-[#C9A24D] underline-offset-4 hover:underline">Terms</Link>{' '}and{' '}
                      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-[#C9A24D] underline-offset-4 hover:underline">Privacy Policy</Link>
                    </span>
                  </label>
                  <PhoneFieldError msg={fieldErrors.agreeToTerms} />
                </div>
              </div>
            </section>
          </form>
        )}
      </div>

      {/* Back / Continue - always on screen, above the iPhone home bar */}
      {registrationStep !== 'verify' && (
        <div className="shrink-0 border-t border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#111113] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-18px_rgba(0,0,0,0.25)]">
          {phoneFooterError && (
            <div role="alert" aria-live="assertive" data-testid="phone-footer-error" className="mb-2.5 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[13px] font-semibold leading-snug text-red-600 dark:text-red-300">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <span>{phoneFooterError}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {phoneStep > 1 && (
              <button type="button" onClick={phoneBack} disabled={isLoading}
                className="h-12 shrink-0 rounded-xl border border-gray-300 dark:border-gray-700 px-5 text-sm font-bold text-[#111827] dark:text-white transition-colors active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-60">
                Back
              </button>
            )}
            <button type="submit" form="m-signup" disabled={isLoading}
              className="ohp-auth-btn flex h-12 flex-1 items-center justify-center rounded-xl bg-[#111827] px-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-colors active:bg-[#C9A24D] dark:bg-white dark:text-[#111827] disabled:opacity-70">
              {phoneStep < 4 ? 'Continue' : isLoading ? (
                <span className="flex items-center">
                  <svg className="-ml-1 mr-2.5 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* ---- Tablet / desktop (md and up): the single-page layout, unchanged ---- */}
    <div className="hidden md:flex h-screen flex-col lg:flex-row overflow-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      {/* Left Section - Form (55%) */}
      <div className="w-full lg:w-[55%] h-full relative z-0 flex flex-col overflow-hidden transition-colors duration-300">
        <PageBackgroundGrid />
        <AuthLuxeStyle />
        <QrBadge
          visible={motifVisible}
          className="ohp-motif-float hidden lg:block absolute top-10 right-10 w-[170px] h-[170px] text-[#C9A24D] opacity-[0.2] dark:opacity-[0.26] -z-10"
        />

        {/* Content Container */}
        <div className="relative z-10 w-full h-full overflow-hidden flex flex-col items-center justify-center px-6 py-4">
          {/* Logo - Compact for no-scroll mobile layout */}
          <Link href="/" className="mb-4 lg:mb-12 flex flex-col items-center group">
            <h1 className="text-[28px] sm:text-[32px] text-[#111827] dark:text-white"><GoldPal animate /></h1>
          </Link>

          {/* Notification Toast */}
          {notification.type && (
            <div className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'info' ? 'bg-blue-500 text-white' : ''
            }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {notification.type === 'success' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'error' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{notification.message}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setNotification({ type: null, message: '' })}
                  className="inline-flex text-white hover:text-gray-200 focus:outline-none focus:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

      {registrationStep === 'verify' ? (
        // Step 2: Email Verification
        verifyScreen
      ) : (
        // Step 1: Registration Form
        <div className="max-w-[640px] w-full">
          {/* Header */}
          <div className="mb-4 text-center">
            <AuthKicker>Start free</AuthKicker>
            <h2 className="mb-2 font-serif text-4xl font-black tracking-[-0.02em] text-[#0B0B0B] dark:text-white">Create <em className="ohp-home-em">Account.</em></h2>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm font-medium">Start your {TRIAL_PERIOD_DAYS}-day free trial today.</p>
          </div>

          {/* Registration Form */}
          <div className="ohp-auth-card bg-white dark:bg-[#151517] rounded-3xl p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 transition-colors">
            <form method="post" onSubmit={handleSubmit} className="space-y-3">
              <div className="flex justify-center pb-1">
                <div role="tablist" aria-label="Which MLS are you in?" className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 bg-[#FAFAF7] dark:bg-[#0B0B0B] p-1">
                  {([['bright', 'Bright MLS agent'], ['other', 'Not in Bright MLS']] as const).map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={audience === id} onClick={() => switchAudience(id)}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${audience === id ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 hover:text-[#0B0B0B] dark:text-gray-400 dark:hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {!isBright && (
                <p className="-mt-1 text-center text-[11px] font-medium leading-snug text-[#6B7280] dark:text-gray-400">
                  No MLS data needed - you&apos;ll get the No-MLS plans and can start right away.
                </p>
              )}
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.firstName 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="John"
                  />
                  {fieldErrors.firstName && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.firstName}</p>}
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.lastName 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="Smith"
                  />
                  {fieldErrors.lastName && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              {/* Email and MLS ID (or license number) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-1">
                  <label htmlFor="email" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    Email address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={`block w-full pl-9 pr-4 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                        fieldErrors.email 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                      }`}
                      placeholder="john.smith@example.com"
                    />
                  </div>
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.email}</p>}
                </div>

                {isBright ? (
                <div>
                  <label htmlFor="mlsId" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    MLS ID
                  </label>
                  <input
                    id="mlsId"
                    name="mlsId"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formData.mlsId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) {
                        handleChange(e);
                      }
                    }}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.mlsId 
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="1234567"
                  />
                  {fieldErrors.mlsId && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.mlsId}</p>}
                  {signupCode && <p className="mt-1 text-xs font-semibold text-[#8b7355] dark:text-[#d7b974] pl-1">Test account code {signupCode} applied</p>}
                </div>
                ) : (
                <div>
                  <label htmlFor="licenseNumber" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    License number
                  </label>
                  <input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    required
                    maxLength={40}
                    autoComplete="off"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.licenseNumber
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="e.g. RS123456"
                  />
                  {fieldErrors.licenseNumber && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.licenseNumber}</p>}
                </div>
                )}
              </div>

              {/* State and Brokerage Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="state" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    State
                  </label>
                  <div className="relative">
                    <select
                      id="state"
                      name="state"
                      required
                      value={formData.state}
                      onChange={(e: any) => handleChange(e)}
                      className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm appearance-none cursor-pointer ${
                        fieldErrors.state 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                      }`}
                    >
                      <option value="" disabled>Select State</option>
                      {US_STATES.map((state) => (
                        <option key={state.code} value={state.code}>
                          {state.name} ({state.code})
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {fieldErrors.state && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.state}</p>}
                </div>
                
                <div>
                  <label htmlFor="brokerage" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    Brokerage
                  </label>
                  {isBright ? (
                  <BrokerageAutocomplete
                    value={formData.brokerage}
                    onChange={(val) => {
                      setFormData(prev => ({ ...prev, brokerage: val }))
                      if (fieldErrors.brokerage) {
                        setFieldErrors(prev => ({ ...prev, brokerage: '' }))
                      }
                    }}
                    onValidationChange={(isValid) => {
                      setIsBrokerageValid(isValid)
                    }}
                    error={!!fieldErrors.brokerage}
                    placeholder="Re/Max..."
                  />
                  ) : (
                  <input
                    id="brokerage"
                    name="brokerage"
                    type="text"
                    required
                    maxLength={120}
                    value={formData.brokerage}
                    onChange={handleChange}
                    className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                      fieldErrors.brokerage
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="Your brokerage"
                  />
                  )}
                  {fieldErrors.brokerage && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.brokerage}</p>}
                </div>
              </div>


              {/* Password Fields */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="password" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className={`block w-full pl-9 pr-10 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                        fieldErrors.password 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                      }`}
                      placeholder="Strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#111827] dark:hover:text-white focus:outline-none transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.password}</p>}
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider mb-1 ml-1">
                    Confirm password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`block w-full pl-9 pr-4 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
                        fieldErrors.confirmPassword 
                          ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
                          : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
                      }`}
                      placeholder="Confirm password"
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-500 font-medium pl-1">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              {/* General Error */}
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Terms Agreement */}
              <div>
                <label className="flex items-start space-x-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded peer-checked:bg-[#111827] dark:peer-checked:bg-[#C9A24D] peer-checked:border-[#111827] dark:peer-checked:border-[#C9A24D] transition-all duration-200"></div>
                    <svg className="absolute top-1 left-1 w-3 h-3 text-white dark:text-[#111827] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-[#6B7280] dark:text-gray-400 leading-relaxed group-hover:text-[#111827] dark:group-hover:text-white transition-colors font-medium">
                    I agree to the{' '}
                    <Link 
                      href="/terms" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A24D] font-bold hover:text-[#111827] dark:hover:text-white transition-colors hover:underline underline-offset-4"
                    >
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link 
                      href="/privacy" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A24D] font-bold hover:text-[#111827] dark:hover:text-white transition-colors hover:underline underline-offset-4"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {fieldErrors.agreeToTerms && <p className="mt-1 text-xs text-red-500 font-medium pl-8">{fieldErrors.agreeToTerms}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="ohp-auth-btn w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-xl text-sm font-black uppercase tracking-widest text-white bg-[#111827] dark:bg-white dark:text-[#111827] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827] transform transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white dark:text-[#111827]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </div>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
              <div className="text-center">
                <span className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">Already have an account?</span>
                <Link href="/login" className="ml-2 text-xs font-black text-[#111827] dark:text-white hover:text-[#C9A24D] transition-colors uppercase tracking-widest hover:underline underline-offset-4">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest flex items-center justify-center gap-1.5 opacity-60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Protected by industry-standard encryption
            </p>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* Right Section - Explanation (45%) */}
      <div className="hidden lg:flex w-full lg:w-[45%] relative bg-[#151517] text-white overflow-hidden flex-col justify-center">
        {/* Rich Background Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.28),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#2a2218_100%)]"></div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent opacity-80"></div>
        
        {/* Decorative Patterns */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        </div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#8b7355] rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>

        <div className="relative z-10 p-12 lg:p-16 flex flex-col justify-center h-full">
          <div className="max-w-xl mx-auto lg:mx-0">
            <h3 className="mb-2 text-4xl font-black uppercase tracking-tight"><GoldPal /></h3>
            <p className="text-gray-300 text-lg mb-6 font-light whitespace-nowrap">The all-in-one platform for modern real estate agents.</p>
            <div className="h-1 w-20 bg-gradient-to-r from-[#e8c97a] to-[#8b7355] rounded-full mb-12"></div>
            
            <div className="relative h-56">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute top-0 left-0 w-full transition-all duration-700 transform ${
                    index === currentSlide 
                      ? 'opacity-100 translate-x-0' 
                      : index < currentSlide 
                        ? 'opacity-0 -translate-x-full' 
                        : 'opacity-0 translate-x-full'
                  }`}
                >
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10 shadow-lg">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#8b7355] to-[#6b5840] rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        {slide.icon}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#e8c97a]">{slide.kicker}</p>
                        <h4 className="font-serif font-black text-xl text-white leading-tight">{slide.title}</h4>
                      </div>
                    </div>
                    <p className="text-gray-300 text-base leading-relaxed font-light">{slide.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide Indicators */}
            <div className="flex space-x-3 mt-8 justify-center lg:justify-start">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'bg-[#e8c97a] w-8' 
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="mt-16 pt-8 border-t border-white/10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#e8c97a] animate-pulse"></div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Now in early access</p>
              </div>
              <p className="text-sm text-gray-300/80 font-light leading-relaxed">
                "We're building the most advanced AI and productivity tools in real estate - the ones that actually save agents time, keep them prepared and organized, and help them close more deals. If you're serious about this business, this is the tech you should be running on."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
