"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Zap, Check, ArrowRight, CreditCard, Info, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  limits: { tokens: string; requests: string; models: string; support: string };
  popular?: boolean;
}

function ManagePlanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<"month" | "year">("month");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState("free");
  const [currentPlanName, setCurrentPlanName] = useState("Free");
  const [planPrice, setPlanPrice] = useState(0);
  const [renewDate, setRenewDate] = useState("");
  const [message, setMessage] = useState("");

  const loadBillingData = useCallback(async () => {
    const [subscription, availablePlans] = await Promise.all([
      apiClient.getCurrentSubscription(),
      apiClient.getAvailablePlans(),
    ]);
    const sub = subscription as {
      plan?: { id?: string; name?: string; price?: number };
      currentPeriodEnd?: string;
      isPaid?: boolean;
    };
    setPlans(availablePlans as Plan[]);
    setCurrentPlanId(sub.plan?.id || "free");
    setCurrentPlanName(sub.plan?.name || "Free");
    setPlanPrice(sub.plan?.price ?? 0);
    if (sub.currentPeriodEnd) {
      setRenewDate(new Date(sub.currentPeriodEnd).toLocaleDateString());
    }
    return sub;
  }, []);

  useEffect(() => {
    const init = async () => {
      const checkout = searchParams.get("checkout");
      const sessionId = searchParams.get("session_id");

      if (checkout === "success" && sessionId) {
        setConfirming(true);
        setMessage("Payment received — activating your plan...");
        try {
          await apiClient.confirmCheckout(sessionId);
          await refreshUser();
          await loadBillingData();
          setMessage("Plan upgraded successfully! Synced with desktop app.");
        } catch (err) {
          // Poll in case webhook is slow
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const sub = await loadBillingData();
            if (sub.plan?.id && sub.plan.id !== "free") break;
          }
          const sub = await apiClient.getCurrentSubscription() as { plan?: { id?: string } };
          if (sub.plan?.id && sub.plan.id !== "free") {
            setMessage("Plan activated! Synced with desktop app.");
            await refreshUser();
          } else {
            setMessage(err instanceof Error ? err.message : "Payment received — refresh in a moment.");
          }
        } finally {
          setConfirming(false);
          router.replace("/dashboard/manage-plan");
        }
        return;
      }

      if (checkout === "cancelled") {
        setMessage("Checkout cancelled.");
        router.replace("/dashboard/manage-plan");
      }

      try {
        await loadBillingData();
      } catch (error) {
        console.error("Failed to load billing:", error);
      }

      // Repair: paid in Stripe but webhook/redirect missed
      try {
        const sub = await apiClient.getCurrentSubscription() as { plan?: { id?: string } };
        if (!sub.plan?.id || sub.plan.id === "free") {
          await apiClient.syncBilling();
          await loadBillingData();
          await refreshUser();
        }
      } catch {
        /* no stripe customer yet */
      }
    };
    init();
  }, [searchParams, loadBillingData, refreshUser, router]);

  const handlePlanChange = async (planId: string) => {
    if (planId === currentPlanId) return;
    try {
      setLoading(true);
      const result = await apiClient.updateSubscription({ planId, interval: billingCycle });

      if (result.checkoutUrl || result.requiresPayment) {
        const checkout = result.checkoutUrl
          ? { url: result.checkoutUrl }
          : await apiClient.createCheckoutSession(planId, billingCycle);
        if (checkout.url) {
          window.location.href = checkout.url;
          return;
        }
      }

      await loadBillingData();
      await refreshUser();
      setMessage(`Plan changed to ${planId}. Synced with desktop app.`);
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      console.error("Plan change error:", error);
      alert(error instanceof Error ? error.message : "Plan change failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setLoading(true);
      const { url } = await apiClient.createPortalSession();
      if (url) window.location.href = url;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to open billing portal.");
    } finally {
      setLoading(false);
    }
  };

  const getPlanPrice = (plan: Plan) =>
    billingCycle === "month" ? plan.price : Math.round(plan.price * 10);

  const getPlanButton = (plan: Plan) => {
    const isCurrent = plan.id === currentPlanId;
    if (isCurrent) {
      return (
        <button className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg font-medium">
          Current Plan
        </button>
      );
    }

    return (
      <button
        onClick={() => handlePlanChange(plan.id)}
        disabled={loading || confirming}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Redirecting...
          </>
        ) : (
          <>
            Switch to {plan.name}
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </button>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Manage Your Plan</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Synced with Xander AI IDE desktop — same account, same plan
        </p>

        {confirming && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4 mb-4 flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Activating your subscription...
          </div>
        )}

        {message && !confirming && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4 mb-4 text-green-800 dark:text-green-200 text-sm">
            {message}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Stripe Test Mode:</strong> Use card 4242 4242 4242 4242. After payment, your plan updates automatically.
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setBillingCycle("month")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              billingCycle === "month" ? "bg-white dark:bg-gray-700 shadow-sm" : ""
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("year")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              billingCycle === "year" ? "bg-white dark:bg-gray-700 shadow-sm" : ""
            }`}
          >
            Yearly <span className="ml-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Save 17%</span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Current Plan: {currentPlanName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {renewDate ? `Renews on ${renewDate}` : "Change your plan anytime"}
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">${planPrice}/mo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 ${
              plan.popular ? "border-blue-500" : "border-gray-200 dark:border-gray-800"
            } p-6`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                Most Popular
              </span>
            )}
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <p className="text-3xl font-bold mb-6">${getPlanPrice(plan)}<span className="text-base font-normal text-gray-500">/{billingCycle}</span></p>
            <div className="mb-6">{getPlanButton(plan)}</div>
            <ul className="space-y-2">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Billing & Payment</h2>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium">Stripe Billing Portal</p>
              <p className="text-xs text-gray-500">Invoices, payment method, cancel</p>
            </div>
          </div>
          <button onClick={handleManageBilling} disabled={loading || currentPlanId === "free"}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-40">
            Open Portal
          </button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Info className="w-4 h-4" /> Payments processed securely by Stripe.
        </p>
      </div>
    </div>
  );
}

export default function ManagePlanPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <ManagePlanContent />
    </Suspense>
  );
}
