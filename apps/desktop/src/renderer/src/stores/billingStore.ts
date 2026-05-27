import { create } from 'zustand';
import apiClient, { Plan, Subscription, UsageData } from '../lib/api';

interface BillingState {
  subscription: Subscription | null;
  plans: Plan[];
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  changePlan: (planId: string, interval?: string) => Promise<void>;
  cancelPlan: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  plans: [],
  usage: null,
  loading: false,
  error: null,

  fetchAll: async () => {
    if (!apiClient.getToken()) return;
    set({ loading: true, error: null });
    try {
      let subscription = await apiClient.getCurrentSubscription();
      if (!subscription?.plan?.id || subscription.plan.id === 'free') {
        try {
          subscription = await apiClient.syncBilling();
        } catch {
          /* no stripe subscription yet */
        }
      }
      const [plans, usage] = await Promise.all([
        apiClient.getAvailablePlans(),
        apiClient.getUsage(),
      ]);
      set({ subscription, plans, usage, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load billing',
        loading: false,
      });
    }
  },

  changePlan: async (planId: string, interval = 'month') => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.updateSubscription(planId, interval);
      if (result.checkoutUrl || result.requiresPayment) {
        const checkoutUrl =
          result.checkoutUrl ||
          (await apiClient.createCheckoutSession(planId, interval)).url;
        if (checkoutUrl && window.electronAPI?.openExternal) {
          await window.electronAPI.openExternal(checkoutUrl);
        } else if (checkoutUrl) {
          window.open(checkoutUrl, '_blank');
        }
        set({ loading: false });
        // Poll for plan update after external checkout
        const poll = setInterval(async () => {
          await get().fetchAll();
          const sub = get().subscription;
          if (sub?.plan?.id && sub.plan.id !== 'free') clearInterval(poll);
        }, 3000);
        setTimeout(() => clearInterval(poll), 120000);
        return;
      }
      await get().fetchAll();
      set({ loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Plan change failed',
        loading: false,
      });
      throw err;
    }
  },

  cancelPlan: async () => {
    set({ loading: true, error: null });
    try {
      const subscription = await apiClient.cancelSubscription();
      set({ subscription, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Cancel failed',
        loading: false,
      });
      throw err;
    }
  },
}));
