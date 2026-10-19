
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

// Use the configured API URL, with environment-appropriate defaults.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://imgeditor-api-staging.onrender.com'
    : 'http://localhost:5000')
).replace(/\/+$/, '');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Redirect to workspace if the user is already logged in.
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) return;

    let user = null;

    try {
      user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      localStorage.removeItem('user');
    }

    navigate(user?.role === 'admin' ? '/admin' : '/workspace', {
      replace: true,
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      if (!data.token || !data.user) {
        throw new Error('The server returned an invalid login response');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Notify the existing Navbar to synchronize its user state.
      window.dispatchEvent(new Event('userUpdated'));

      // Preserve role-based navigation after login.
      navigate(
        data.user.role === 'admin' ? '/admin' : '/workspace',
        { replace: true }
      );
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Unable to connect to the server. Please check your connection and try again.'
          : err.message || 'Failed to login'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold !text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-slate-500">
            Sign in to access your workspace and AI tools
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Email Address
            </label>

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Password
            </label>

            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />

              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-11 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-indigo-600"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-indigo-600 font-bold hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
