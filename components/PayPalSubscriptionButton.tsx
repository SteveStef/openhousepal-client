'use client'

import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useState } from "react";

interface RegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  state: string;
  brokerage: string;
  mls_id?: string;
}

interface PayPalSubscriptionButtonProps {
  planId: string;
  bundleCode?: string;
  registrationData: RegistrationData;
  isCheckoutOnly?: boolean;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function PayPalSubscriptionButton({
  planId,
  bundleCode,
  registrationData,
  isCheckoutOnly = false,
  onSuccess,
  onError
}: PayPalSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [{ isPending }] = usePayPalScriptReducer();

  const getToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') return value;
    }
    return null;
  }

  return (
    <div className="w-full min-h-[150px] relative">
      {isPending && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-4 bg-[#FAFAF7] dark:bg-[#151517] rounded-xl transition-colors">
          <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"></div>
          <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"></div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-[#C9A24D] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Securely loading PayPal...</span>
          </div>
        </div>
      )}
      
      <div className="paypal-button-container">
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
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
              
              if (isCheckoutOnly) {
                let url = `${apiUrl}/auth/link-subscription?subscription_id=${encodeURIComponent(data.subscriptionID || '')}&plan_id=${encodeURIComponent(planId)}`;
                if (bundleCode) url += `&bundle_code=${encodeURIComponent(bundleCode)}`;

                const response = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                  }
                });

                if (response.ok) {
                  onSuccess();
                } else {
                  const errorData = await response.json();
                  onError(errorData.detail || 'Failed to link subscription.');
                }
              } else {
                let url = `${apiUrl}/auth/signup-with-subscription?subscription_id=${encodeURIComponent(data.subscriptionID || '')}&plan_id=${encodeURIComponent(planId)}`;
                if (bundleCode) url += `&bundle_code=${encodeURIComponent(bundleCode)}`;

                const response = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: registrationData.email,
                    password: registrationData.password,
                    first_name: registrationData.first_name,
                    last_name: registrationData.last_name,
                    state: registrationData.state,
                    brokerage: registrationData.brokerage,
                    mls_id: registrationData.mls_id
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (typeof document !== 'undefined' && result.access_token) {
                    const expires = new Date();
                    expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000));
                    document.cookie = `auth_token=${result.access_token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
                  }
                  onSuccess();
                } else {
                  const errorData = await response.json();
                  onError(errorData.detail || 'Failed to create account.');
                }
              }
            } catch (error) {
              console.error('Error in payment processing:', error);
              onError('Failed to process payment. Please try again.');
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
      </div>

      {loading && (
        <div className="flex items-center justify-center mt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8b7355] dark:border-[#C9A24D]"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400 font-medium">Processing...</span>
        </div>
      )}
    </div>
  );
}
