'use client'

import { useState } from "react";
import { CardPayButtons } from "./CardPayButtons";
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
      {/* Card checkout; paying with a PayPal account shows "coming soon" (CardPayButtons). */}
      <div className="paypal-button-container">
        <CardPayButtons
          start={{ plan_id: planId }}
          onApproved={link}
          onCancel={() => onError('Payment setup was cancelled. Please complete payment to continue.')}
          onError={onError}
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
