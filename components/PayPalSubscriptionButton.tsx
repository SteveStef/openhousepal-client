'use client'

import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useState } from "react";
import api from "../lib/api-service";

interface PayPalSubscriptionButtonProps {
  planId: string;
  bundleCode?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  isCheckoutOnly?: boolean; // Kept for compatibility with checkout page
}

export default function PayPalSubscriptionButton({
  planId,
  bundleCode,
  onSuccess,
  onError,
  isCheckoutOnly = true
}: PayPalSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  // An approved PayPal subscription we couldn't attach to the account yet (bad connection,
  // server hiccup). Retrying re-links THIS one - never start a second subscription.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [{ isPending }] = usePayPalScriptReducer();

  const link = async (subscriptionId: string) => {
    setLoading(true);
    try {
      const { success, error } = await api.auth.linkSubscription(subscriptionId, planId, bundleCode);
      if (success) {
        setPendingId(null);
        onSuccess();
      } else {
        setPendingId(subscriptionId);
        onError(error || 'Failed to link subscription.');
      }
    } catch (error) {
      console.error('Error in payment processing:', error);
      setPendingId(subscriptionId);
      onError('Your PayPal approval went through, but we could not finish setting up your account. Tap "Finish activation" to try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingId) {
    return (
      <div className="w-full min-h-[150px] flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">PayPal approved your subscription. One last step to switch your account on.</p>
        <button
          type="button"
          onClick={() => link(pendingId)}
          disabled={loading}
          className="w-full rounded-xl bg-[#111827] px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-[#C9A24D] disabled:opacity-60 dark:bg-[#C9A24D] dark:text-[#111827]"
        >
          {loading ? 'Finishing...' : 'Finish activation'}
        </button>
        <p className="text-xs text-gray-400">You won't be charged twice. Still stuck? Email support and mention PayPal ID {pendingId}.</p>
      </div>
    );
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
          onApprove={async (data) => {
            await link(data.subscriptionID || '');
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
