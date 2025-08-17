'use client'

export const runtime = 'edge';

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OpenHouseSignInForm from '@/components/OpenHouseSignInForm'
import { Property, SignInFormData } from '@/types'

// Mock data for development - will be replaced with API calls
const mockProperty: Property = {
  id: 1,
  address: "123 Main Street, West Chester, PA 19380",
  city: "West Chester",
  state: "PA",
  zipCode: "19380",
  price: 1200000,
  beds: 5,
  baths: 3.5,
  squareFeet: 5000,
  lotSize: 1.0,
  propertyType: "Single Family",
  description: "Beautiful colonial home in desirable West Chester location"
}

export default function OpenHouseSignInPage() {
  const params = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const qrCode = params.qr as string

  useEffect(() => {
    // Simulate API call to fetch property data based on QR code
    const fetchPropertyData = async () => {
      try {
        setIsLoading(true)
        
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/open-house/${qrCode}`)
        // const data = await response.json()
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // For now, use mock data
        setProperty(mockProperty)
        setError(null)
      } catch (err) {
        setError('Failed to load property information. Please try again.')
        console.error('Error fetching property:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (qrCode) {
      fetchPropertyData()
    }
  }, [qrCode])

  const handleFormSubmit = async (formData: SignInFormData) => {
    try {
      setIsSubmitting(true)
      setError(null)

      // TODO: Replace with actual API call
      // const response = await fetch('/api/customers', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     ...formData,
      //     propertyId: property?.id,
      //     qrCode,
      //   }),
      // })

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      console.log('Form submitted:', { ...formData, propertyId: property?.id, qrCode })
      
      setSuccess(true)

    } catch (err) {
      setError('Failed to submit form. Please try again.')
      console.error('Error submitting form:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading property information...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl p-8 text-center border border-gray-700">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Oops!</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl p-8 text-center border border-gray-700">
          <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Thank you!</h2>
          <p className="text-gray-300 mb-6">
            Your information has been submitted successfully. We'll be in touch soon!
          </p>
          <p className="text-zinc-400 text-sm">
            You can close this page or continue exploring our listings.
          </p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl p-8 text-center border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-2">Property Not Found</h2>
          <p className="text-gray-300">
            We couldn't find the property associated with this QR code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900 py-8 px-4 flex items-center justify-center">
      <OpenHouseSignInForm
        property={property}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}
