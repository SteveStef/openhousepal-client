'use client'

import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useState } from "react";
import { register as registerUser } from '../lib/auth';

interface RegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  state: string;
  brokerage: string;
}

interface PayPalSubscriptionButtonProps {
  planId: string;
  registrationData: RegistrationData;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function PayPalSubscriptionButton({
  planId,
  registrationData,
  onSuccess,
  onError
}: PayPalSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  // Show error message if PayPal script failed to load
  if (isRejected) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-900 mb-1">PayPal Temporarily Unavailable</h3>
              <p className="text-sm text-red-700">
                We're having trouble connecting to PayPal right now. This is usually temporary. Please try again in a few minutes.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-sm text-red-800 underline hover:text-red-900"
              >
                Refresh page to try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isPending && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b7355]"></div>
          <span className="ml-3 text-gray-600">Loading PayPal...</span>
        </div>
      )}
      <PayPalButtons
        style={{
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "subscribe"
        }}
        createSubscription={async (data, actions) => {
          try {
            // Use the plan ID passed as prop
            return actions.subscription.create({
              plan_id: planId
            });
          } catch (error) {
            console.error('Error creating subscription:', error);
            onError('Failed to initialize subscription');
            throw error;
          }
        }}
        onApprove={async (data, actions) => {
          setLoading(true);
          try {
            // Atomically create account with subscription (all-or-nothing)
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/auth/signup-with-subscription?subscription_id=${encodeURIComponent(data.subscriptionID || '')}&plan_id=${encodeURIComponent(planId)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: registrationData.email,
                password: registrationData.password,
                first_name: registrationData.first_name,
                last_name: registrationData.last_name,
                state: registrationData.state,
                brokerage: registrationData.brokerage
              })
            });

            if (response.ok) {
              // Success! Account and subscription created atomically
              const result = await response.json();

              // Store token in cookie (matching auth.ts pattern)
              if (typeof document !== 'undefined' && result.access_token) {
                const expires = new Date();
                expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
                document.cookie = `auth_token=${result.access_token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
              }

              onSuccess();
            } else {
              const errorData = await response.json();
              onError(errorData.detail || 'Failed to create account. Please try again.');
            }
          } catch (error) {
            console.error('Error in signup with subscription:', error);
            onError('Failed to complete registration. Please try again.');
          } finally {
            setLoading(false);
          }
        }}
        onCancel={() => {
          onError('Payment setup was cancelled. Please complete payment to continue.');
        }}
        onError={(err) => {
          console.error('PayPal error:', err);
          onError('Payment system error. Please try again.');
        }}
        disabled={loading}
      />
      {loading && (
        <div className="flex items-center justify-center mt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8b7355]"></div>
          <span className="ml-2 text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
}
