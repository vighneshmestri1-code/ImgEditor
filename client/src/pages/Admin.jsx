
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Shield,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Coins,
  CalendarDays,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Plus,
  Minus,
  CheckCircle2,
  Mail,
  Wallet,
} from 'lucide-react';

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const API_URL = `${API_ORIGIN}/api/admin`;

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

const readResponse = async (response) => {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const formatNumber = (value) =>
  (Number(value) || 0).toLocaleString();

const formatDate = (date) => {
  if (!date) return 'Not available';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available';
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (date) => {
  if (!date) return 'Date unavailable';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date unavailable';
  }

  return parsedDate.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const makeRequestKey = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

const getInitial = (user) =>
  (user?.name || user?.username || user?.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase();

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Credit management.
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // Credit history.
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [creditHistoryPage, setCreditHistoryPage] = useState(1);
  const [creditHistoryPagination, setCreditHistoryPagination] =
    useState({
      page: 1,
      limit: 10,
      totalTransactions: 0,
      totalPages: 1,
    });
  const [creditHistoryLoading, setCreditHistoryLoading] =
    useState(false);

  // Keep an idempotency key when retrying the same adjustment.
  const adjustmentKeyRef = useRef(null);
  const detailsRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);

    try {
      const response = await fetch(`${API_URL}/stats`, {
        headers: getAuthHeaders(),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to load dashboard statistics'
        );
      }

      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (currentPage, searchTerm) => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '10',
        search: searchTerm,
      });

      const response = await fetch(`${API_URL}/users?${params}`, {
        headers: getAuthHeaders(),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load users');
      }

      setUsers(Array.isArray(data.users) ? data.users : []);

      setPagination(
        data.pagination || {
          page: currentPage,
          limit: 10,
          totalUsers: 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreditTransactions = useCallback(
    async (userId, currentPage = 1) => {
      const requestId = ++historyRequestRef.current;

      setCreditHistoryLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: '10',
        });

        const response = await fetch(
          `${API_URL}/users/${userId}/credit-transactions?${params}`,
          { headers: getAuthHeaders() }
        );

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error || 'Failed to load credit history'
          );
        }

        // Ignore an older request if the selected user has changed.
        if (requestId !== historyRequestRef.current) return;

        setCreditTransactions(
          Array.isArray(data.transactions) ? data.transactions : []
        );

        setCreditHistoryPagination(
          data.pagination || {
            page: currentPage,
            limit: 10,
            totalTransactions: 0,
            totalPages: 1,
          }
        );

        setCreditHistoryPage(currentPage);
      } catch (err) {
        if (requestId === historyRequestRef.current) {
          setError(err.message || 'Failed to load credit history');
        }
      } finally {
        if (requestId === historyRequestRef.current) {
          setCreditHistoryLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers(page, search);
  }, [fetchUsers, page, search]);

  const handleRefresh = () => {
    setError('');
    setNotice('');
    fetchStats();
    fetchUsers(page, search);

    if (selectedUser) {
      fetchCreditTransactions(selectedUser._id, creditHistoryPage);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();

    const nextSearch = searchInput.trim();

    setNotice('');

    if (nextSearch === search && page === 1) {
      fetchUsers(1, nextSearch);
      return;
    }

    setPage(1);
    setSearch(nextSearch);
  };

  const closeUserDetails = () => {
    detailsRequestRef.current += 1;
    historyRequestRef.current += 1;

    setSelectedUser(null);
    setDetailsLoadingId(null);
    setCreditTransactions([]);
    setCreditHistoryLoading(false);
    setCreditHistoryPage(1);

    setCreditAmount('');
    setCreditDescription('');
    adjustmentKeyRef.current = null;
  };

  const handleViewDetails = async (userId) => {
    const requestId = ++detailsRequestRef.current;

    setDetailsLoadingId(userId);
    setSelectedUser(null);
    setCreditTransactions([]);
    setCreditHistoryPage(1);
    setCreditAmount('');
    setCreditDescription('');
    adjustmentKeyRef.current = null;

    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        headers: getAuthHeaders(),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load user details');
      }

      if (requestId !== detailsRequestRef.current) return;

      setSelectedUser(data.user);

      await fetchCreditTransactions(userId, 1);
    } catch (err) {
      if (requestId === detailsRequestRef.current) {
        setError(err.message || 'Failed to load user details');
      }
    } finally {
      if (requestId === detailsRequestRef.current) {
        setDetailsLoadingId(null);
      }
    }
  };

  const handleCreditAdjustment = async (event) => {
    event.preventDefault();

    if (!selectedUser || creditSubmitting) return;

    if (selectedUser.role === 'admin') {
      setError('Credit adjustments for admin accounts are disabled.');
      return;
    }

    const amount = Number(creditAmount);
    const description = creditDescription.trim();

    if (
      !Number.isSafeInteger(amount) ||
      amount === 0 ||
      Math.abs(amount) > 10000
    ) {
      setError(
        'Enter a non-zero whole-number adjustment within 10,000 credits.'
      );
      return;
    }

    if (!description || description.length > 300) {
      setError('Enter a reason of 1–300 characters.');
      return;
    }

    const selectedUserId = selectedUser._id;
    const signature = `${selectedUserId}|${amount}|${description}`;

    setCreditSubmitting(true);
    setError('');
    setNotice('');

    try {
      // Reuse the same key only when retrying the same operation.
      if (
        !adjustmentKeyRef.current ||
        adjustmentKeyRef.current.signature !== signature
      ) {
        adjustmentKeyRef.current = {
          signature,
          key: `admin-ui-${selectedUserId}-${makeRequestKey()}`,
        };
      }

      const response = await fetch(
        `${API_URL}/users/${selectedUserId}/credits`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
            'Idempotency-Key': adjustmentKeyRef.current.key,
          },
          body: JSON.stringify({
            amount,
            description,
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to adjust credits');
      }

      // Use the balance returned by the backend.
      setSelectedUser((previous) =>
        previous && previous._id === selectedUserId
          ? { ...previous, credits: data.balance }
          : previous
      );

      setUsers((previous) =>
        previous.map((user) =>
          user._id === selectedUserId
            ? { ...user, credits: data.balance }
            : user
        )
      );

      adjustmentKeyRef.current = null;
      setCreditAmount('');
      setCreditDescription('');
      setNotice(
        data.message || 'Credit adjustment completed successfully.'
      );

      await Promise.all([
        fetchStats(),
        fetchUsers(page, search),
        fetchCreditTransactions(selectedUserId, 1),
      ]);
    } catch (err) {
      // Keep the key following a failed request, so retrying the
      // same operation cannot accidentally apply it twice.
      setError(err.message || 'Failed to adjust credits');
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const displayName = user.name || user.email || 'this user';

    if (user.role === 'admin') {
      setError('Admin accounts are protected from deletion.');
      return;
    }

    if (
      !window.confirm(
        `Delete ${displayName} permanently? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(user._id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/users/${user._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      if (selectedUser?._id === user._id) {
        closeUserDetails();
      }

      setNotice('User deleted successfully.');

      await fetchStats();

      if (users.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await fetchUsers(page, search);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers,
      icon: Users,
      iconStyle: 'bg-indigo-50 text-indigo-600',
      accent: 'from-indigo-500 to-violet-500',
      helper: 'Registered accounts',
    },
    {
      label: 'Verified Accounts',
      value: stats?.verifiedUsers,
      icon: UserCheck,
      iconStyle: 'bg-emerald-50 text-emerald-600',
      accent: 'from-emerald-500 to-teal-500',
      helper: 'Verified or legacy accounts',
    },
    {
      label: 'Pending Verification',
      value: stats?.pendingUsers,
      icon: UserX,
      iconStyle: 'bg-amber-50 text-amber-600',
      accent: 'from-amber-500 to-orange-500',
      helper: 'Awaiting verification',
    },
    {
      label: 'Total Credits',
      value: stats?.totalCredits,
      icon: Coins,
      iconStyle: 'bg-violet-50 text-violet-600',
      accent: 'from-violet-500 to-fuchsia-500',
      helper: 'Across all user accounts',
    },
    {
      label: 'New Users · 7 Days',
      value: stats?.newUsersLast7Days,
      icon: CalendarDays,
      iconStyle: 'bg-sky-50 text-sky-600',
      accent: 'from-sky-500 to-cyan-500',
      helper: 'Recently registered',
    },
    {
      label: 'Admin Accounts',
      value: stats?.adminUsers,
      icon: ShieldCheck,
      iconStyle: 'bg-rose-50 text-rose-600',
      accent: 'from-rose-500 to-pink-500',
      helper: 'Privileged accounts',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Premium dashboard header */}
        <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 right-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                ImgEditor Control Center
              </div>

              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Admin Dashboard
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Manage your community, monitor credits, and review account
                activity from one workspace.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Admin access
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                  <Wallet className="h-3.5 w-3.5" />
                  Credit management
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={statsLoading || loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  statsLoading || loading ? 'animate-spin' : ''
                }`}
              />
              Refresh dashboard
            </button>
          </div>
        </header>

        {/* Status messages */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />

            <span className="flex-1 leading-6">{error}</span>

            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss error"
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && !error && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="flex-1">{notice}</span>

            <button
              type="button"
              onClick={() => setNotice('')}
              aria-label="Dismiss notice"
              className="rounded-lg p-1 transition hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Overview */}
        <section aria-labelledby="overview-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold !text-slate-900 tracking-tight">
                Overview
              </p>
              <h2
                id="overview-heading"
                className="mt-1 text-xl font-extrabold tracking-tight !text-black"
              >
                Platform insights
              </h2>
            </div>

            <span className="text-xs text-slate-400">
              {statsLoading ? 'Updating…' : 'Live from your database'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.label}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`}
                  />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {card.label}
                      </p>

                      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                        {statsLoading ? '—' : formatNumber(card.value)}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-400">
                        {card.helper}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl p-3 transition group-hover:scale-105 ${card.iconStyle}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Selected user details and credit tools */}
        {selectedUser && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-black text-white shadow-lg shadow-indigo-600/20">
                  {getInitial(selectedUser)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                      User details
                    </h2>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        selectedUser.role === 'admin'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {selectedUser.role || 'user'}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm text-slate-500">
                    {selectedUser.name ||
                      selectedUser.username ||
                      selectedUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeUserDetails}
                aria-label="Close user details"
                className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-auto"
              >
                <X className="h-4 w-4" />
                Close details
              </button>
            </div>

            <div className="p-5 sm:p-7">
              {/* Account information */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="h-4 w-4" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      Email address
                    </p>
                  </div>

                  <p className="mt-2 break-all text-sm font-semibold text-slate-800">
                    {selectedUser.email || 'Not provided'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <UserCheck className="h-4 w-4" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      Verification
                    </p>
                  </div>

                  <p
                    className={`mt-2 text-sm font-bold ${
                      selectedUser.isVerified === false
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {selectedUser.isVerified === false
                      ? 'Pending verification'
                      : 'Verified'}
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="flex items-center gap-2 text-indigo-500">
                    <Coins className="h-4 w-4" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      Available credits
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-black tabular-nums text-indigo-700">
                    {formatNumber(selectedUser.credits ?? 5)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Registered
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 p-4 sm:col-span-1 lg:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    User ID
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-600">
                    {selectedUser._id}
                  </p>
                </div>
              </div>

              {/* Credit management panels */}
              <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                {/* Adjustment form */}
                <form
                  onSubmit={handleCreditAdjustment}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                      <Wallet className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Credit adjustment
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Every adjustment is validated by the server and
                        recorded in the transaction ledger.
                      </p>
                    </div>
                  </div>

                  {selectedUser.role === 'admin' ? (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Credit adjustments for administrator accounts are
                      disabled.
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-bold">
                              Add credits
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-700/80">
                            Enter a positive amount
                          </p>
                        </div>

                        <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                          <div className="flex items-center gap-2 text-rose-700">
                            <Minus className="h-4 w-4" />
                            <span className="text-xs font-bold">
                              Remove credits
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-rose-700/80">
                            Enter a negative amount
                          </p>
                        </div>
                      </div>

                      <label
                        htmlFor="creditAmount"
                        className="mt-5 block text-xs font-bold text-slate-700"
                      >
                        Adjustment amount
                      </label>

                      <input
                        id="creditAmount"
                        type="number"
                        step="1"
                        min="-10000"
                        max="10000"
                        required
                        value={creditAmount}
                        onChange={(event) =>
                          setCreditAmount(event.target.value)
                        }
                        placeholder="Example: 50 or -10"
                        disabled={creditSubmitting}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                      />

                      <label
                        htmlFor="creditDescription"
                        className="mt-4 block text-xs font-bold text-slate-700"
                      >
                        Reason for adjustment
                      </label>

                      <textarea
                        id="creditDescription"
                        rows={3}
                        maxLength={300}
                        required
                        value={creditDescription}
                        onChange={(event) =>
                          setCreditDescription(event.target.value)
                        }
                        placeholder="Explain why the credits are being adjusted..."
                        disabled={creditSubmitting}
                        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
                      />

                      <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-400">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Adjustments are admin-only and recorded with the
                          adjustment reason.
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={
                          creditSubmitting ||
                          !creditAmount ||
                          !creditDescription.trim()
                        }
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                      >
                        {creditSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Coins className="h-4 w-4" />
                        )}
                        {creditSubmitting
                          ? 'Processing adjustment…'
                          : 'Apply credit adjustment'}
                      </button>
                    </>
                  )}
                </form>

                {/* Credit transaction history */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                        <History className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          Credit history
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Auditable balance changes
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {formatNumber(
                        creditHistoryPagination.totalTransactions
                      )}{' '}
                      entries
                    </span>
                  </div>

                  <div className="min-h-64 p-4 sm:p-5">
                    {creditHistoryLoading ? (
                      <div className="flex min-h-56 flex-col items-center justify-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <p className="mt-3 text-xs font-medium">
                          Loading transaction history…
                        </p>
                      </div>
                    ) : creditTransactions.length === 0 ? (
                      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center">
                        <div className="rounded-2xl bg-white p-3 text-slate-300 shadow-sm">
                          <History className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-bold text-slate-700">
                          No transactions yet
                        </p>
                        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                          Credit grants, deductions, and adjustments will
                          appear here when recorded.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {creditTransactions.map((transaction) => {
                          const positive = transaction.amount > 0;

                          return (
                            <article
                              key={transaction._id}
                              className="rounded-xl border border-slate-100 p-3.5 transition hover:border-slate-200 hover:bg-slate-50/70"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 rounded-xl p-2 ${
                                    positive
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'bg-rose-50 text-rose-600'
                                  }`}
                                >
                                  {positive ? (
                                    <ArrowUpRight className="h-4 w-4" />
                                  ) : (
                                    <ArrowDownRight className="h-4 w-4" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-bold capitalize text-slate-800">
                                      {String(transaction.type || 'transaction')
                                        .replace(/_/g, ' ')}
                                    </p>

                                    <span
                                      className={`text-sm font-black tabular-nums ${
                                        positive
                                          ? 'text-emerald-600'
                                          : 'text-rose-600'
                                      }`}
                                    >
                                      {positive ? '+' : ''}
                                      {formatNumber(transaction.amount)}
                                    </span>
                                  </div>

                                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                                    {transaction.description ||
                                      'No description provided'}
                                  </p>

                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                      {formatNumber(
                                        transaction.balanceBefore
                                      )}{' '}
                                      →{' '}
                                      {formatNumber(
                                        transaction.balanceAfter
                                      )}{' '}
                                      balance
                                    </span>

                                    <span className="text-[10px] text-slate-400">
                                      {formatDateTime(transaction.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                    <p className="text-[11px] text-slate-500">
                      Page {creditHistoryPage} of{' '}
                      {creditHistoryPagination.totalPages}
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          fetchCreditTransactions(
                            selectedUser._id,
                            Math.max(1, creditHistoryPage - 1)
                          )
                        }
                        disabled={
                          creditHistoryLoading || creditHistoryPage <= 1
                        }
                        aria-label="Previous credit-history page"
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          fetchCreditTransactions(
                            selectedUser._id,
                            Math.min(
                              creditHistoryPagination.totalPages,
                              creditHistoryPage + 1
                            )
                          )
                        }
                        disabled={
                          creditHistoryLoading ||
                          creditHistoryPage >=
                            creditHistoryPagination.totalPages
                        }
                        aria-label="Next credit-history page"
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* User management */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 ">
                Accounts
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="!text-black font-bold">
                  User management
                </h2>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {formatNumber(pagination.totalUsers)} accounts
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Search profiles, inspect credit balances, and manage
                eligible accounts.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="flex w-full gap-2 lg:max-w-md"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name, username, or email"
                  aria-label="Search users by name, username, or email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-6 py-4">Account</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Verification</th>
                  <th className="px-4 py-4">Credits</th>
                  <th className="px-4 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                        Loading user accounts…
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="rounded-2xl bg-slate-100 p-3 text-slate-400">
                          <Users className="h-6 w-6" />
                        </div>

                        <p className="mt-3 text-sm font-bold text-slate-800">
                          No accounts found
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Try a different search term or clear your search.
                        </p>

                        {search && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchInput('');
                              setSearch('');
                              setPage(1);
                            }}
                            className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user._id}
                      className={`transition hover:bg-indigo-50/30 ${
                        selectedUser?._id === user._id
                          ? 'bg-indigo-50/50'
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                              user.role === 'admin'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {getInitial(user)}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-bold text-slate-900">
                              {user.name || user.username || 'Unnamed user'}
                            </p>

                            <p className="mt-1 max-w-56 truncate text-xs text-slate-500">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            user.role === 'admin'
                              ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {user.role === 'admin' && (
                            <Shield className="h-3 w-3" />
                          )}
                          {user.role || 'user'}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {user.isVerified === false ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                            <UserX className="h-3.5 w-3.5" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 font-extrabold tabular-nums text-indigo-700">
                          <Coins className="h-4 w-4 text-indigo-400" />
                          {formatNumber(user.credits ?? 5)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-slate-500">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(user._id)}
                            disabled={detailsLoadingId === user._id}
                            title="View user details and credit history"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {detailsLoadingId === user._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            Details
                          </button>

                          {user.role !== 'admin' ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={deletingId === user._id}
                              title="Delete user"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId === user._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-400">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Protected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* User pagination */}
          <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              Showing{' '}
              <span className="font-bold text-slate-700">
                {users.length ? (page - 1) * pagination.limit + 1 : 0}
                {'–'}
                {(page - 1) * pagination.limit + users.length}
              </span>{' '}
              of{' '}
              <span className="font-bold text-slate-700">
                {formatNumber(pagination.totalUsers)}
              </span>{' '}
              matching account{pagination.totalUsers === 1 ? '' : 's'}
              {search ? (
                <>
                  {' '}
                  for <span className="font-semibold">“{search}”</span>
                </>
              ) : null}
            </p>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-semibold text-slate-600">
                Page {page} of {pagination.totalPages}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  disabled={loading || page <= 1}
                  aria-label="Previous user page"
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1)
                    )
                  }
                  disabled={loading || page >= pagination.totalPages}
                  aria-label="Next user page"
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 px-1 pb-2 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>ImgEditor · Admin Control Center</p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin operations are validated by the backend
          </p>
        </footer>
      </div>
    </div>
  );
}
