'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OpenHouseSignInForm from '@/components/OpenHouseSignInForm'
import { Property, SignInFormData } from '@/types'

const ComplianceFooter = () => (
  <div className="mt-12 text-center max-w-3xl mx-auto pb-4 px-4">
    <p className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
      © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available. 
      <span className="block sm:inline ml-0 sm:ml-1">Data last updated: {new Date().toLocaleDateString()}</span>
    </p>
  </div>
)

export default function OpenHouseSignInPage() {
  const router = useRouter()
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] mx-auto mb-4"></div>
            <p className="text-[#6B7280] font-medium">Loading property details...</p>
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] px-4 p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-black text-[#0B0B0B] mb-2 tracking-tight">Unable to Load Property</h2>
            <p className="text-[#6B7280] mb-8 leading-relaxed">{error}</p>
            <div className="space-y-4">
              <button
                onClick={() => router.refresh()}
                className="w-full bg-[#111827] hover:bg-[#C9A24D] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02]"
              >
                Try Again
              </button>
              <p className="text-gray-400 text-xs">
                If this problem persists, please contact the property agent directly.
              </p>
            </div>
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] px-4 p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-[#0B0B0B] mb-3 tracking-tight">Thank You!</h2>
            <p className="text-[#6B7280] mb-8 leading-relaxed font-medium">
              Your information has been submitted successfully.
            </p>
            
            {property && (
              <div className="bg-[#FAFAF7] rounded-xl p-5 mb-8 text-left border border-gray-100">
                <h3 className="font-bold text-[#0B0B0B] text-sm uppercase tracking-wide mb-2">Property You Visited</h3>
                <p className="text-[#111827] text-base font-semibold mb-2">{property.address}</p>
                <div className="flex items-center space-x-4 text-xs font-bold text-[#6B7280] uppercase tracking-widest">
                  <span>{property.beds} beds</span>
                  <span className="text-[#C9A24D]">•</span>
                  <span>{property.baths} baths</span>
                </div>
              </div>
            )}
            
            <p className="text-gray-400 text-xs">
              You can close this page now or continue browsing.
            </p>
          </div>
        </div>
        <ComplianceFooter />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h2 className="text-xl font-black text-[#0B0B0B] mb-2 tracking-tight">Property Not Found</h2>
          <p className="text-[#6B7280] mb-6 leading-relaxed">
            This property listing may have been removed or is no longer available.
          </p>
          <p className="text-gray-400 text-xs">
            Please check the QR code or contact the agent directly for assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-4">
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-lg">
          {/* Form */}
          <OpenHouseSignInForm
            property={property}
            onSubmit={handleFormSubmit}
            isLoading={isSubmitting}
          />
        </div>
      </div>

      {/* Compliance Footer */}
      <div className="mt-12 text-center max-w-3xl mx-auto pb-4">
        <p className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
          © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available. 
          <span className="block sm:inline ml-0 sm:ml-1">Data last updated: {new Date().toLocaleDateString()}</span>
        </p>
      </div>
    </div>
  )
}
