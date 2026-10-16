import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [step, setStep] = useState(1); // Step 1: Input details, Step 2: Input OTP
  const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60); // 60-second OTP timer
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();

  // Redirect to workspace if user is already logged in (Option 1 check)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/workspace', { replace: true });
    }
  }, [navigate]);

  // Handle OTP countdown timer when entering Step 2
  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const startOtpTimer = () => {
    setTimer(60);
    setCanResend(false);
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setStep(2);
      startOtpTimer();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          otp: formData.otp.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/workspace');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-[85vh] bg-[#edf2f7] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold !text-slate-900 tracking-tight text-center">
          {step === 1 ? 'Create Account' : 'Enter Verification Code'}
        </h2>
        <p className="text-xs text-center text-slate-500 mb-6">
          {step === 1 ? 'Sign up to access all AI tools' : `We sent a 6-digit OTP to ${formData.email}`}
        </p>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">User Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-indigo-600"
                placeholder="Username"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-indigo-600"
                placeholder="Email"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl pl-4 pr-11 py-2.5 text-sm focus:outline-indigo-600"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition text-sm disabled:opacity-50"
            >
              {loading ? 'Sending OTP to Email...' : 'Send Email OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 block">6-Digit OTP</label>
                <span className="text-xs font-medium text-slate-500">
                  {timer > 0 ? `Expires in ${timer}s` : 'OTP Expired'}
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.otp}
                onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-center tracking-widest text-lg font-bold focus:outline-indigo-600"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading || timer === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP & Complete Signup'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canResend || loading}
                onClick={handleSendOTP}
                className="w-1/2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold py-2.5 rounded-xl transition text-xs disabled:opacity-50"
              >
                Resend OTP
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-1/2 bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold py-2.5 rounded-xl transition text-xs"
              >
                Back to Details
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-center text-slate-500 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}