'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OpenHouseSignInForm from '@/components/OpenHouseSignInForm'
import { Property, SignInFormData } from '@/types'

export default function OpenHouseSignInPage() {
  const params = useParams()
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const openHouseEventId = params.openHouseEventId as string

  useEffect(() => {
    // Fetch property data from open house event by ID
    const fetchData = async () => {
      try {
        setIsLoading(true)
        
        // Fetch property data using the open house event ID from the URL
        const propertyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/open-house/property/${openHouseEventId}`)
        
        if (!propertyResponse.ok) {
          throw new Error('Property not found')
        }
        
        const responseData = await propertyResponse.json()
        const propertyData = responseData.property
        //console.log('Property data:', propertyData);
        
        // Transform the API response to match the Property interface
        const transformedProperty: Property = {
          id: propertyData.id,
          address: propertyData.address,
          city: propertyData.city || '',
          state: propertyData.state || '',
          zipCode: propertyData.zipCode || '',
          price: propertyData.price || 0,
          beds: propertyData.beds || 0,
          baths: propertyData.baths || 0,
          squareFeet: propertyData.squareFeet || 0,
          lotSize: propertyData.lotSize || 0,
          propertyType: propertyData.propertyType || '',
          description: propertyData.description || '',
          imageSrc: propertyData.imageSrc || ''
        }
        
        setProperty(transformedProperty)
        setError(null)
      } catch (err) {
        setError('Failed to load property information. Please try again.')
        console.error('Error fetching data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (openHouseEventId) {
      fetchData()
    }
  }, [openHouseEventId])

  const handleFormSubmit = async (formData: SignInFormData) => {
    try {
      setIsSubmitting(true)
      setError(null)
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/open-house/submit`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          has_agent: formData.hasAgent,
          open_house_event_id: openHouseEventId,
          interested_in_similar: formData.interestedInSimilar,
        }),
      });

      console.log('Form submitted:', {
        ...formData,
        openHouseEventId,
        timestamp: new Date().toISOString()
      })

      if (response.ok) {
        const result = await response.json()
      } else {
        console.error('Failed to submit form, but showing success to user')
      }

      // Always show success message to user (fail silently)
      setSuccess(true)

    } catch (err) {
      // Log error but still show success message to user
      console.error('Error submitting form:', err)
      setSuccess(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading property details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Property</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#8b7355] hover:bg-[#7a6549] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
            >
              Try Again
            </button>
            <p className="text-gray-500 text-xs">
              If this problem persists, please contact the property agent directly.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your information has been submitted successfully.
          </p>
          
          {property && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Property You Visited:</h3>
              <p className="text-gray-600 text-sm">{property.address}</p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>{property.beds} beds</span>
                <span>•</span>
                <span>{property.baths} baths</span>
              </div>
            </div>
          )}
          
          <p className="text-gray-500 text-sm">
            You can close this page now or continue browsing.
          </p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Property Not Found</h2>
          <p className="text-gray-600 mb-4">
            This property listing may have been removed or is no longer available.
          </p>
          <p className="text-gray-500 text-sm">
            Please check the QR code or contact the agent directly for assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Form */}
        <OpenHouseSignInForm
          property={property}
          onSubmit={handleFormSubmit}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  )
}
