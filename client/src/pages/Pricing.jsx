
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Check,
  ShieldCheck,
  Zap,
  Crown,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  LockKeyhole,
} from 'lucide-react';

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const API_URL = `${API_ORIGIN}/api/subscriptions`;
const RAZORPAY_SCRIPT =
  'https://checkout.razorpay.com/v1/checkout.js';

const HEADING_STYLE = { color: '#0f172a' };

async function readResponse(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return true;

  return new Promise((resolve, reject) => {
    let script = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT}"]`
    );

    if (script?.dataset.loaded === 'true') {
      if (window.Razorpay) {
        resolve(true);
      } else {
        reject(
          new Error('Razorpay Checkout did not initialize.')
        );
      }
      return;
    }

    const handleLoad = () => {
      if (window.Razorpay) {
        resolve(true);
      } else {
        reject(
          new Error('Razorpay Checkout did not initialize.')
        );
      }
    };

    const handleError = () => {
      reject(new Error('Could not load Razorpay Checkout.'));
    };

    if (!script) {
      script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT;
      script.async = true;
    } else {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
      },
      { once: true }
    );

    if (!script.isConnected) {
      document.body.appendChild(script);
    }
  });
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

const LOCAL_PLANS = [
  {
    key: 'free',
    name: 'ImgEditor Free',
    priceInr: 0,
    creditsPerCycle: 10,
    billingPeriod: 'signup',
    description: 'A simple way to get started.',
    available: true,
  },
  {
    key: 'pro',
    name: 'ImgEditor Pro',
    priceInr: 299,
    creditsPerCycle: 100,
    billingPeriod: 'monthly',
    description: 'More creative freedom for regular use.',
    available: true,
  },
  {
    key: 'premium',
    name: 'ImgEditor Premium',
    priceInr: 599,
    creditsPerCycle: 300,
    billingPeriod: 'monthly',
    description: 'More credits for your creative workflow.',
    available: true,
  },
];

const FEATURES = {
  free: [
    '10 signup credits',
    'Access to the image workspace',
    'Core image editing tools',
  ],
  pro: [
    '100 credits per billing period',
    'Access to all current image tools',
    'Credit transaction history',
    'Monthly subscription',
  ],
  premium: [
    '300 credits per billing period',
    'Access to all current image tools',
    'Credit transaction history',
    'Monthly subscription',
  ],
};

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function formatStatus(status) {
  if (!status) return 'Unknown';

  return String(status)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function Pricing() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = readStoredUser();

  const [plans, setPlans] = useState(LOCAL_PLANS);
  const [plansLoading, setPlansLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] =
    useState(null);
  const [subscriptionLoading, setSubscriptionLoading] =
    useState(false);

  const [busyPlanKey, setBusyPlanKey] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);

    try {
      const response = await fetch(`${API_URL}/plans`);
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to load subscription plans.'
        );
      }

      if (Array.isArray(data.plans)) {
        setPlans(data.plans);
      }
    } catch (err) {
      setError(
        err.message || 'Unable to load subscription plans.'
      );
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchCurrentSubscription = useCallback(async () => {
    if (!token) {
      setCurrentSubscription(null);
      setSubscriptionLoading(false);
      return;
    }

    setSubscriptionLoading(true);

    try {
      const response = await fetch(`${API_URL}/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to load current subscription.'
        );
      }

      setCurrentSubscription(data.subscription || null);
    } catch (err) {
      setError(
        err.message || 'Unable to load current subscription.'
      );
    } finally {
      setSubscriptionLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, [fetchPlans, fetchCurrentSubscription]);

  const subscriptionStatus = String(
    currentSubscription?.status || ''
  ).toLowerCase();

  // Only an active subscription is shown as the current paid plan.
  // Checkout authorization alone does not confirm a successful charge.
  const isPaidSubscriptionActive =
    subscriptionStatus === 'active';

  // Do not create another paid subscription while the current one
  // still needs authorization or server-side payment confirmation.
  const hasSubscriptionInProgress = [
    'created',
    'pending',
    'authenticated',
  ].includes(subscriptionStatus);

  const handleStartFree = () => {
    setError('');
    setNotice('');

    if (!token) {
      navigate('/register');
      return;
    }

    navigate('/workspace');
  };

  const handleSubscribe = async (plan) => {
    if (busyPlanKey) return;

    setError('');
    setNotice('');

    if (!token) {
      navigate('/login');
      setNotice('Please sign in to start a paid subscription.');
      return;
    }

    if (!plan.available) {
      setError('This plan is not available for checkout yet.');
      return;
    }

    if (
      isPaidSubscriptionActive ||
      hasSubscriptionInProgress
    ) {
      setError(
        'A subscription already exists or is being processed. ' +
        'Refresh its status before starting another subscription.'
      );
      return;
    }

    setBusyPlanKey(plan.key);

    try {
      const createResponse = await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planKey: plan.key,
        }),
      });

      const subscriptionData = await readResponse(
        createResponse
      );

      if (!createResponse.ok) {
        throw new Error(
          subscriptionData.error ||
          'Unable to create subscription.'
        );
      }

      if (
        !subscriptionData.subscriptionId ||
        !subscriptionData.keyId
      ) {
        throw new Error(
          'The server did not return valid Checkout details.'
        );
      }

      await loadRazorpayCheckout();

      let checkoutResponseReceived = false;

      const options = {
        key: subscriptionData.keyId,
        subscription_id: subscriptionData.subscriptionId,
        name: 'ImgEditor',
        description: `${plan.name} · ₹${plan.priceInr}/month`,
        prefill: {
          name: user.name || user.username || '',
          email: user.email || '',
        },
        notes: {
          plan_key: plan.key,
          app: 'ImgEditor',
        },
        theme: {
          color: '#4f46e5',
        },

        handler: async (checkoutResponse) => {
          checkoutResponseReceived = true;
          setError('');
          setNotice(
            'Verifying your Razorpay Checkout response…'
          );

          try {
            const verifyResponse = await fetch(
              `${API_URL}/verify`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(checkoutResponse),
              }
            );

            const verifyData = await readResponse(
              verifyResponse
            );

            if (
              !verifyResponse.ok ||
              !verifyData.verified
            ) {
              throw new Error(
                verifyData.error ||
                'Checkout verification failed.'
              );
            }

            setNotice(
              'Checkout response verified. Paid credits will ' +
              'be added only after the server confirms a ' +
              'successful subscription charge.'
            );

            await fetchCurrentSubscription();
          } catch (err) {
            setError(
              err.message ||
              'Checkout verification could not be completed.'
            );
            setNotice('');
          } finally {
            setBusyPlanKey(null);
          }
        },

        modal: {
          ondismiss: () => {
            setBusyPlanKey(null);

            if (!checkoutResponseReceived) {
              setNotice(
                'Checkout was closed. Payment success has not ' +
                'been confirmed.'
              );
            }
          },
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on('payment.failed', (event) => {
        checkoutResponseReceived = false;
        setBusyPlanKey(null);
        setNotice('');

        setError(
          event.error?.description ||
          'Razorpay could not complete the authorization payment.'
        );
      });

      checkout.open();
    } catch (err) {
      setError(
        err.message || 'Unable to start Razorpay Checkout.'
      );
      setBusyPlanKey(null);
    }
  };

  const refreshSubscription = async () => {
    setError('');
    setNotice('');

    await Promise.all([
      fetchPlans(),
      fetchCurrentSubscription(),
    ]);
  };

  const planIcon = (key) => {
    if (key === 'premium') return Crown;
    if (key === 'pro') return Zap;
    return Sparkles;
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">

        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-5 py-10 text-center shadow-xl shadow-indigo-950/10 sm:rounded-[2rem] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-10 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative mx-auto max-w-3xl">
            <div className="mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-100 sm:tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>ImgEditor Plans</span>
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              More credits.
              <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
                More creativity.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl break-words text-sm leading-7 text-slate-200 sm:text-base">
              Choose a plan that fits your creative flow, from
              trying the essentials to using ImgEditor more often.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-slate-200">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                Secure checkout
              </span>

              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                Transparent monthly pricing
              </span>
            </div>
          </div>
        </section>

        {/* Feedback */}
        <div
          className="mx-auto mt-6 max-w-4xl space-y-3"
          aria-live="polite"
        >
          {error && (
            <div
              role="alert"
              className="flex min-w-0 items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />

              <span className="min-w-0 flex-1 break-words leading-6">
                {error}
              </span>

              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
                className="shrink-0 rounded-lg p-1 text-rose-900 hover:bg-rose-100"
              >
                ×
              </button>
            </div>
          )}

          {notice && !error && (
            <div
              role="status"
              className="flex min-w-0 items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

              <span className="min-w-0 break-words leading-6">
                {notice}
              </span>
            </div>
          )}
        </div>

        {/* Current subscription */}
        {token && (
          <section className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="shrink-0 rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2
                    className="break-words text-sm font-extrabold"
                    style={HEADING_STYLE}
                  >
                    Your subscription
                  </h2>

                  {subscriptionLoading ? (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      Checking your current plan…
                    </p>
                  ) : currentSubscription ? (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      {currentSubscription.planKey?.toUpperCase() || 'PLAN'}
                      {' · '}
                      {formatStatus(currentSubscription.status)}

                      {currentSubscription.currentPeriodEnd
                        ? ` · Period ends ${formatDate(
                            currentSubscription.currentPeriodEnd
                          )}`
                        : ''}
                    </p>
                  ) : (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      No subscription record found. Your free signup
                      credits remain available.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={refreshSubscription}
                disabled={plansLoading || subscriptionLoading}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    subscriptionLoading ? 'animate-spin' : ''
                  }`}
                />
                Refresh status
              </button>
            </div>

            {hasSubscriptionInProgress && (
              <div
                role="status"
                className="mt-4 flex min-w-0 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

                <p className="min-w-0 break-words">
                  Your subscription is still being processed. It is
                  not yet confirmed as an active paid plan. Avoid
                  starting another subscription until its status has
                  been resolved. Paid credits are granted only after
                  the server confirms a successful subscription charge.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Pricing */}
        <section className="mt-10 sm:mt-12">
          <div className="mb-7 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              Simple plans
            </p>

            <h2
              className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl"
              style={HEADING_STYLE}
            >
              Choose your creative toolkit
            </h2>

            <p className="mx-auto mt-3 max-w-2xl break-words text-sm leading-6 text-slate-700">
              Start free, then upgrade when you need more credits.
            </p>
          </div>

          {plansLoading && (
            <div className="flex items-center justify-center gap-3 py-10 text-sm font-medium text-slate-700 sm:py-16">
              <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-indigo-700" />
              Loading plans…
            </div>
          )}

          {!plansLoading && plans.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm leading-6 text-slate-700">
              No subscription plans are available right now. Please
              refresh the page and try again.
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = planIcon(plan.key);
              const premium = plan.key === 'premium';
              const pro = plan.key === 'pro';

              const selected =
                isPaidSubscriptionActive &&
                currentSubscription?.planKey === plan.key;

              const isBusy = busyPlanKey === plan.key;
              const isPaid = Number(plan.priceInr) > 0;

              const blockedBySubscription =
                isPaid &&
                (hasSubscriptionInProgress ||
                  isPaidSubscriptionActive);

              const disabled =
                plansLoading ||
                isBusy ||
                (isPaid && !plan.available) ||
                blockedBySubscription;

              let buttonLabel;

              if (isBusy) {
                buttonLabel = 'Preparing checkout…';
              } else if (plan.key === 'free') {
                buttonLabel = token
                  ? 'Open workspace'
                  : 'Get started free';
              } else if (selected) {
                buttonLabel = 'Current plan';
              } else if (hasSubscriptionInProgress) {
                buttonLabel =
                  currentSubscription?.planKey === plan.key
                    ? 'Subscription pending'
                    : 'Subscription in progress';
              } else if (!plan.available) {
                buttonLabel = 'Unavailable';
              } else if (isPaidSubscriptionActive) {
                buttonLabel = 'Active subscription exists';
              } else {
                buttonLabel = 'Choose plan';
              }

              return (
                <article
                  key={plan.key}
                  className={`relative flex min-w-0 h-full flex-col rounded-3xl border bg-white p-5 shadow-sm transition duration-200 hover:shadow-lg sm:p-6 ${
                    pro
                      ? 'border-indigo-300 ring-2 ring-indigo-500/15'
                      : 'border-slate-200'
                  }`}
                >
                  {pro && (
                    <div className="absolute -top-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full bg-indigo-700 px-4 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-lg">
                      Most popular
                    </div>
                  )}

                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div
                      className={`shrink-0 rounded-2xl p-3 ${
                        premium
                          ? 'bg-violet-100 text-violet-800'
                          : pro
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {selected && (
                      <span className="max-w-[65%] break-words rounded-full bg-emerald-50 px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        Your active plan
                      </span>
                    )}
                  </div>

                  <h3
                    className="mt-5 break-words text-xl font-black tracking-tight"
                    style={HEADING_STYLE}
                  >
                    {String(plan.name || plan.key).replace(
                      'ImgEditor ',
                      ''
                    )}
                  </h3>

                  <p className="mt-2 min-h-10 break-words text-xs leading-5 text-slate-700">
                    {plan.description}
                  </p>

                  <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      className="break-words text-3xl font-black tracking-tight sm:text-4xl"
                      style={HEADING_STYLE}
                    >
                      ₹{Number(plan.priceInr).toLocaleString('en-IN')}
                    </span>

                    <span className="text-xs font-medium text-slate-600">
                      {Number(plan.priceInr) === 0
                        ? 'one-time'
                        : '/ month'}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <p
                      className="break-words text-2xl font-black tabular-nums"
                      style={HEADING_STYLE}
                    >
                      {Number(plan.creditsPerCycle).toLocaleString(
                        'en-IN'
                      )}
                    </p>

                    <p className="mt-1 break-words text-xs font-semibold text-slate-700">
                      {plan.key === 'free'
                        ? 'signup credits'
                        : 'credits per billing period'}
                    </p>
                  </div>

                  <div className="mt-6 flex-1 space-y-3">
                    {(FEATURES[plan.key] || []).map((feature) => (
                      <div
                        key={feature}
                        className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-slate-700"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            premium
                              ? 'bg-violet-100 text-violet-800'
                              : pro
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>

                        <span className="min-w-0 break-words">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      plan.key === 'free'
                        ? handleStartFree()
                        : handleSubscribe(plan)
                    }
                    disabled={disabled}
                    className={`mt-7 inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-bold leading-5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      pro
                        ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-700/20 hover:bg-indigo-600'
                        : premium
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {isBusy ? (
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    )}

                    <span className="min-w-0 break-words">
                      {buttonLabel}
                    </span>
                  </button>

                  {isPaid && (
                    <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-center text-[10px] leading-5 text-slate-600">
                      <LockKeyhole className="h-3 w-3 shrink-0" />
                      Checkout uses Razorpay
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Payment verification note */}
        <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-center sm:p-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h2
            className="mt-3 break-words text-sm font-extrabold"
            style={HEADING_STYLE}
          >
            Payment verification matters
          </h2>

          <p className="mx-auto mt-2 max-w-xl break-words text-xs leading-6 text-slate-700">
            Checkout confirmation alone does not add credits. ImgEditor
            waits for server-side payment verification and a confirmed
            subscription charge before granting paid credits.
          </p>

          <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-center text-[10px] font-semibold leading-5 text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />

            {import.meta.env.PROD
              ? 'Secure subscription flow'
              : 'Development mode · verify with Razorpay Test Mode'}
          </p>
        </section>
      </div>
    </main>
  );
}
