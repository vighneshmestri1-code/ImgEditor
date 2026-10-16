import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, User, LogOut, ChevronDown, ShieldCheck, LayoutGrid } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const dropdownRef = useRef(null);

  // Sync user state live whenever localStorage changes, custom event triggers, or via fast polling
  useEffect(() => {
    const updateUserState = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const storedToken = localStorage.getItem('token');

      // Only update state if data actually changed to avoid unnecessary re-renders
      setUser((prevUser) => {
        if (JSON.stringify(prevUser) !== JSON.stringify(storedUser)) {
          return storedUser;
        }
        return prevUser;
      });

      setToken((prevToken) => (prevToken !== storedToken ? storedToken : prevToken));
    };

    // 1. Listen to cross-tab storage changes
    window.addEventListener('storage', updateUserState);

    // 2. Listen to same-tab custom user update events
    window.addEventListener('userUpdated', updateUserState);

    // 3. Interval check (500ms) to ensure instant UI updates even if event dispatch was missed
    const intervalId = setInterval(updateUserState, 500);

    return () => {
      window.removeEventListener('storage', updateUserState);
      window.removeEventListener('userUpdated', updateUserState);
      clearInterval(intervalId);
    };
  }, []);

  // Sync on route changes
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(storedUser);
    setToken(localStorage.getItem('token'));
  }, [location]);

  // Derive username: user.name -> user.username -> email prefix -> 'User'
  const displayName =
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split('@')[0] : 'User');

  // Credit counter count (defaults to 5 if not set on user object)
  const credits = user?.credits ?? 5;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsOpen(false);
    navigate('/login');
  };

  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 text-slate-900 font-bold text-lg shrink-0">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="hidden xs:inline sm:inline">ImgEditor</span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link
            to="/"
            className={`transition hover:text-indigo-600 ${location.pathname === '/' ? 'text-indigo-600 font-semibold' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/workspace"
            className={`transition hover:text-indigo-600 ${location.pathname === '/workspace' ? 'text-indigo-600 font-semibold' : ''}`}
          >
            Workspace
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`transition hover:text-indigo-600 flex items-center gap-1.5 ${location.pathname === '/admin' ? 'text-indigo-600 font-semibold' : ''}`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Right Section: Credit Counter + Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {token ? (
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Circular Credit Counter Badge - Explicitly displays both badge number & "Credits" text on all screen sizes */}
              <div
                title="Available Credits"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold shrink-0"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-extrabold shadow-sm shrink-0">
                  {credits}
                </div>
                <span className="text-slate-600 text-xs font-medium inline-block">Credits</span>
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>

                {/* Trigger Button */}
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center gap-2 p-1 sm:pr-3 rounded-full bg-slate-100/80 hover:bg-slate-100 text-slate-700 transition border border-slate-200/60 focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm shrink-0">
                    {displayName.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold max-w-[100px] sm:max-w-[120px] truncate hidden sm:inline capitalize">
                    {displayName}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Card */}
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 text-slate-700">

                    {/* User Details Header */}
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate capitalize">
                        {displayName}
                      </p>
                      <p className="text-[11px] font-normal text-slate-500 truncate mt-0.5">
                        {user?.email || 'user@example.com'}
                      </p>
                    </div>

                    {/* Remaining Credits Row */}
                    <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-500">Available Credits</span>
                      <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {credits}
                      </span>
                    </div>

                    {/* Navigation Links */}
                    <div className="py-1">
                      <Link
                        to="/workspace"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        <LayoutGrid className="w-4 h-4 text-slate-400" />
                        <span>Workspace Studio</span>
                      </Link>

                      {user?.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          <ShieldCheck className="w-4 h-4 text-slate-400" />
                          <span>Admin Console</span>
                        </Link>
                      )}
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Log Out</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md shadow-indigo-100"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}