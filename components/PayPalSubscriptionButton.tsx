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
  bundleCode?: string; // New optional prop
  registrationData: RegistrationData;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function PayPalSubscriptionButton({
  planId,
  bundleCode,
  registrationData,
  onSuccess,
  onError
}: PayPalSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  // ... (keeping existing error check)

  return (
    <div className="w-full">
      {/* ... (keeping existing pending check) */}
      <PayPalButtons
        style={{
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "subscribe"
        }}
        createSubscription={async (data, actions) => {
          try {
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            // Added bundle_code to the query string
            let url = `${apiUrl}/auth/signup-with-subscription?subscription_id=${encodeURIComponent(data.subscriptionID || '')}&plan_id=${encodeURIComponent(planId)}`;
            if (bundleCode) {
              url += `&bundle_code=${encodeURIComponent(bundleCode)}`;
            }

            const response = await fetch(url, {
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
