import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#0b0f19] text-slate-400 text-xs font-sans border-t border-slate-800">

      {/* Pre-Footer Call to Action Banner */}
      <div className="w-full bg-[#0f172a] text-white py-16 px-4 text-center border-b border-slate-800/60">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to transform your editing workflow?</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Start manipulating images without software downloads or complex setups.
          </p>
          <div className="pt-2">
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-950/50"
            >
              <span>Launch Workspace Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">

          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-base mb-3">
              <div className="p-1.5 bg-indigo-600 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>Image<span className="text-indigo-400">Studio</span></span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              A modern, browser-native AI image editing platform designed for speed, clarity, and ease of use.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-white font-bold text-xs mb-3 tracking-wider">PRODUCT</h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link to="/" className="hover:text-white transition">Home</Link></li>
              <li><Link to="/workspace" className="hover:text-white transition">Workspace</Link></li>
              <li><Link to="/login" className="hover:text-white transition">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-white transition">Get Started</Link></li>
            </ul>
          </div>

          {/* Core Tools */}
          <div>
            <h4 className="text-white font-bold text-xs mb-3 tracking-wider">CORE TOOLS</h4>
            <ul className="space-y-2 text-[11px]">
              <li><Link to="/workspace" className="hover:text-white transition">Background Remover</Link></li>
              <li><Link to="/workspace" className="hover:text-white transition">Text-to-Image</Link></li>
              <li><Link to="/workspace" className="hover:text-white transition">Image Expander</Link></li>
              <li><Link to="/workspace" className="hover:text-white transition">Quality Enhancer</Link></li>
            </ul>
          </div>

          {/* System Status */}
          <div>
            <h4 className="text-white font-bold text-xs mb-3 tracking-wider">SYSTEM</h4>
            <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All Image Engines Operational</span>
            </div>
            <p className="text-[11px] text-slate-500">
              GPU acceleration active for real-time rendering.
            </p>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-slate-500">
          <p>© 2026 ImageStudio. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-300 transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 transition cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </div>

    </footer>
  );
}