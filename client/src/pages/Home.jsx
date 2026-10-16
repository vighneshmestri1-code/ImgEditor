import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Maximize2,
  Sliders,
  ArrowRight,
  Zap,
  ExternalLink
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  // Check auth state
  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;

  const tools = [
    {
      id: "bg-remover",
      icon: Wand2,
      title: "Background Remover",
      desc: "Instantly isolate subjects and eliminate unwanted background with precision transparency.",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "text-to-image",
      icon: Sparkles,
      title: "Text-to-Image",
      desc: "Transform text prompts into high-resolution visual assets powered by generative AI models.",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "expander",
      icon: Maximize2,
      title: "Image Expander",
      desc: "Seamlessly extend canvas edges and ratio limits with natural AI scene outpainting.",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "editor",
      icon: Sliders,
      title: "Normal Image Editor",
      desc: "Fine-tune color profiles, brightness, contrast, saturation, sharpness, and standard filters.",
      image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80"
    },
    {
      id: "enhancer",
      icon: ImageIcon,
      title: "Quality Enhancer",
      desc: "Upscale resolution, remove compression noise, and recover fine photographic detail.",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80"
    }
  ];

  const steps = [
    {
      num: "01",
      title: "Select a Tool",
      desc: "Choose from our suite of purpose-built AI and browser-native image manipulation utilities."
    },
    {
      num: "02",
      title: "Upload or Prompt",
      desc: "Drop in your existing source image or describe your creative vision text-to-image generator."
    },
    {
      num: "03",
      title: "Export Instantly",
      desc: "Preview your edits on canvas and download crisp uncompressed assets immediately."
    }
  ];

  const testimonials = [
    {
      quote: "The background remover and quality enhancer saved our entire product photography timeline.",
      name: "Alex Morgan",
      role: "Digital Marketer"
    },
    {
      quote: "The text-to-image generator capability is remarkably fast and accurate in this browser setup.",
      name: "Devon Chen",
      role: "Product Designer"
    },
    {
      quote: "Clean, zero-friction workflow. Upgrading resolution on older assets without quality loss is amazing.",
      name: "Sarah Jenkins",
      role: "Content Creator"
    }
  ];

const handleToolClick = (toolId) => {
    localStorage.setItem('activeTab', toolId);

    // Navigate first so current view doesn't jump visual scroll position
    navigate(`/workspace?tab=${toolId}`, { state: { activeTab: toolId }, replace: false });

    // Reset scroll top seamlessly as the new view mounts
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
  };

  return (
    <div className="w-full min-h-screen bg-[#fafafd] text-slate-900 font-sans antialiased pb-12">

      {/* Hero Section */}
      <section className="w-full pt-20 pb-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold mb-8">
            <Zap className="w-3.5 h-3.5 fill-indigo-600" />
            <span>Fast Browser-Native Processing</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
            <span className="text-slate-900 block">Simplify Your Image Editing.</span>
            <span className="text-indigo-600 block mt-1">All-in-one powerful tools.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            Remove backgrounds, generate graphics, expand boundaries, tweak filters, and upscale resolution — all within one clean, unified workspace.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/workspace"
              onClick={() => window.scrollTo(0, 0)}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {!isLoggedIn && (
              <Link
                to="/register"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Core Editing Suite */}
      <section className="w-full py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold !text-slate-900 tracking-tight">Core Editing Suite</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Select any tool below to launch directly into the active workspace tab.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 transition duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Tool Preview Image Header */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={tool.image}
                      alt={tool.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-80" />

                    {/* Tool Icon Badge */}
                    <div className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-white/90 backdrop-blur-md text-indigo-600 flex items-center justify-center shadow-sm">
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Hover CTA Indicator */}
                    <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-white bg-indigo-600/90 backdrop-blur-sm px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                      <span>Launch Tool</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                </div>

                {/* Direct Action Link Text */}
                <div className="px-5 pb-5 pt-1 border-t border-slate-50 flex items-center text-xs font-semibold text-indigo-600 gap-1.5">
                  <span>Try in Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold !text-slate-900 tracking-tight">How It Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Get professional results in three straightforward steps.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
              <span className="text-2xl font-black text-indigo-300 block mb-3">{step.num}</span>
              <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* User Feedback */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold !text-slate-900 tracking-tight">User Feedback</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Trusted by designers, marketers, and digital creators.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between">
              <p className="text-xs text-slate-600 leading-relaxed mb-6">"{t.quote}"</p>
              <div>
                <p className="text-xs font-bold text-slate-900">{t.name}</p>
                <p className="text-[11px] text-slate-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}