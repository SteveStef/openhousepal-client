'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import OpenHouseSignInForm from '@/components/OpenHouseSignInForm'
import { Property, SignInFormData } from '@/types'

export default function OpenHouseSignInPage() {
  const params = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [agentInfo, setAgentInfo] = useState<any>(null)

  const agentId = params.agentId as string
  const propertyId = params.propertyId as string

  useEffect(() => {
    // Fetch property data and agent info based on IDs from URL
    const fetchData = async () => {
      try {
        setIsLoading(true)
        
        // Fetch property data using the property ID from the URL
        const propertyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/properties/${propertyId}`)
        
        if (!propertyResponse.ok) {
          throw new Error('Property not found')
        }
        
        const propertyData = await propertyResponse.json()
        console.log(propertyData);
        
        // Transform the API response to match the Property interface
        const transformedProperty: Property = {
          id: propertyData.property_data.zpid || propertyData.id,
          address: propertyData.address,
          city: propertyData.property_data.city || '',
          state: propertyData.property_data.state || '',
          zipCode: propertyData.property_data.zipCode || '',
          price: propertyData.property_data.price || 0,
          beds: propertyData.property_data.bedrooms || 0,
          baths: propertyData.property_data.bathrooms || 0,
          squareFeet: propertyData.property_data.sqft || "",
          lotSize: propertyData.property_data.lotSize || "",
          propertyType: propertyData.property_data.propertyType || '',
          description: propertyData.property_data.description || ''
        }
        
        setProperty(transformedProperty)
        
        // TODO: Optionally fetch agent information for display
        // const agentResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agentId}`)
        // if (agentResponse.ok) {
        //   const agentData = await agentResponse.json()
        //   setAgentInfo(agentData)
        // }
        
        setError(null)
      } catch (err) {
        setError('Failed to load property information. Please try again.')
        console.error('Error fetching data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (propertyId && agentId) {
      fetchData()
    }
  }, [propertyId, agentId])

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
          visiting_reason: formData.visitingReason,
          timeframe: formData.timeframe,
          has_agent: formData.hasAgent,
          property_id: propertyId,
          agent_id: agentId, // Include agent ID for proper collection assignment
          additional_comments: formData.additionalComments,
          interested_in_similar: formData.interestedInSimilar,
        }),
      });

      console.log('Form submitted:', { 
        ...formData, 
        propertyId, 
        agentId,
        timestamp: new Date().toISOString() 
      })
      
      if (response.ok) {
        setSuccess(true)
      } else {
        throw new Error('Failed to submit form')
      }

    } catch (err) {
      setError('Failed to submit form. Please try again.')
      console.error('Error submitting form:', err)
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
            Your information has been submitted successfully. We'll be in touch soon with properties that match your preferences.
          </p>
          
          {property && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Property You Visited:</h3>
              <p className="text-gray-600 text-sm">{property.address}</p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>{property.beds} beds</span>
                <span>•</span>
                <span>{property.baths} baths</span>
                <span>•</span>
                <span>{property.squareFeet?.toLocaleString()} sq ft</span>
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with property info */}
        <div className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#8b7355] to-[#7a6549] rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Our Open House</h1>
              <p className="text-gray-600 mb-3">{property.address}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                <div className="flex items-center">
                  <span className="font-medium">Price:</span>
                  <span className="ml-1">${property.price?.toLocaleString() || 'Contact Agent'}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium">{property.beds}</span>
                  <span className="ml-1">beds</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium">{property.baths}</span>
                  <span className="ml-1">baths</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium">{property.squareFeet?.toLocaleString()}</span>
                  <span className="ml-1">sq ft</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
