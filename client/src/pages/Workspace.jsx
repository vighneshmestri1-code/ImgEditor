import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scissors, 
  ImageIcon, 
  Sparkles, 
  Maximize2, 
  Upload, 
  Download, 
  Loader2, 
  AlertCircle,
  Sliders,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCw,
  PlusCircle,
  Wand2
} from 'lucide-react';

// Custom Image Viewer Component
function ImageCompareSlider({ originalUrl, processedUrl, activeTool }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  // Standard Output / Input Preview for Non-Image-Editor Tools
  if (activeTool !== 'image-editor') {
    const displayUrl = processedUrl || originalUrl;

    return (
      <div className="w-full h-full min-h-[380px] max-h-[500px] flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative p-2">
        {processedUrl && (
          <span className="absolute top-4 right-4 bg-blue-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm z-10 pointer-events-none tracking-wider">
            PROCESSED RESULT
          </span>
        )}
        <img 
          src={displayUrl} 
          alt="Preview Output" 
          className="max-h-[460px] max-w-full object-contain rounded-xl shadow-sm"
          onError={(e) => {
            console.error("Failed to render image source:", displayUrl);
          }}
        />
      </div>
    );
  }

  // Single Image Preview for Image Editor when process hasn't started
  if (originalUrl && !processedUrl) {
    return (
      <div className="w-full h-full min-h-[380px] max-h-[500px] flex items-center justify-center rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
        <img 
          src={originalUrl} 
          alt="Source Preview" 
          className="max-h-[480px] max-w-full object-contain rounded-xl"
        />
      </div>
    );
  }

  // Before / After Comparison Slider EXCLUSIVELY FOR IMAGE EDITOR
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[380px] max-h-[500px] rounded-2xl overflow-hidden select-none border border-slate-200 cursor-ew-resize flex items-center justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <img 
        src={processedUrl} 
        alt="After" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
      />

      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img 
          src={originalUrl} 
          alt="Before" 
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        />
      </div>

      <span className="absolute top-4 left-4 bg-slate-900/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm z-10 pointer-events-none tracking-wider">
        BEFORE
      </span>
      <span className="absolute top-4 right-4 bg-blue-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm z-10 pointer-events-none tracking-wider">
        AFTER
      </span>

      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-md pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md border-2 border-blue-600 flex items-center justify-center">
          <span className="text-slate-600 text-xs font-bold font-mono">↔</span>
        </div>
      </div>
    </div>
  );
}

export default function Workspace() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState('remove-bg');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tool Specific Options
  const [expandRatio, setExpandRatio] = useState('16:9');

  // Image Editor States
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState(null);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const tools = [
    { id: 'remove-bg', name: 'BG Remover', icon: Scissors, description: 'Instantly cut out background with high accuracy' },
    { id: 'expand', name: 'Image Expander', icon: Maximize2, description: 'Extend image boundaries seamlessly with AI' },
    { id: 'enhance', name: 'Quality Enhancer', icon: Sparkles, description: 'Upscale resolution & remove blur' },
    { id: 'image-editor', name: 'Image Editor', icon: Sliders, description: 'Adjust brightness, contrast, and orientation' },
    { id: 'text-to-image', name: 'Text To Image', icon: ImageIcon, description: 'Generate original images from text descriptions' },
  ];

  const samplePrompts = [
    "A futuristic city with flying vehicles at sunset, digital art",
    "A cute golden retriever wearing a space helmet, cinematic lighting",
    "Minimalist tropical beach landscape, oil painting style"
  ];

  const activeToolObj = tools.find((t) => t.id === activeTool) || tools[0];

  const handleClearImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setResultUrl(null);
    setEditorPreviewUrl(null);
    setError('');
    handleResetEditor();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    handleClearImage();
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'image-editor' || !previewUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewUrl;
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const isRotatedQuarter = (rotation / 90) % 2 !== 0;
      canvas.width = isRotatedQuarter ? img.height : img.width;
      canvas.height = isRotatedQuarter ? img.width : img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

      ctx.drawImage(
        img,
        -img.width / 2,
        -img.height / 2,
        img.width,
        img.height
      );

      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      setEditorPreviewUrl(dataUrl);
    };
  }, [previewUrl, brightness, contrast, saturation, rotation, flipH, flipV, activeTool]);

  const handleResetEditor = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultUrl(null);
      setError('');
      handleResetEditor();
    }
  };

  const handleDownloadUrl = (urlToDownload, filenamePrefix) => {
    try {
      if (urlToDownload.startsWith('data:')) {
        const arr = urlToDownload.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filenamePrefix}-${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        const link = document.createElement('a');
        link.href = urlToDownload;
        link.download = `${filenamePrefix}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDownload = () => {
    if (activeTool === 'image-editor') {
      if (editorPreviewUrl) {
        handleDownloadUrl(editorPreviewUrl, 'edited-image');
      }
    } else if (resultUrl) {
      handleDownloadUrl(resultUrl, `ai-${activeTool}`);
    }
  };

  const handleProcess = async () => {
    if (activeTool === 'image-editor') return;

    setError('');
    setLoading(true);
    setResultUrl(null);

    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      setError('You must be logged in to use AI tools.');
      navigate('/login');
      return;
    }

    const endpoint = `http://localhost:5000/api/tools/${activeTool}`;

    try {
      let response;

      if (activeTool === 'text-to-image') {
        if (!prompt.trim()) throw new Error('Please enter a prompt to generate an image.');

        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            prompt: prompt.trim()
          })
        });
      } else {
        if (!selectedFile) throw new Error('Please select an image file first.');

        const formData = new FormData();
        formData.append('image', selectedFile);

        if (activeTool === 'expand') {
          formData.append('aspectRatio', expandRatio);
        }

        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      if (!response.ok) {
        let errorMessage = 'Failed to process request';
        try {
          const errData = await response.json();
          errorMessage = errData.error || errData.details || errorMessage;
        } catch {
          const errText = await response.text();
          errorMessage = errText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        const outputImageUrl = data.url || data.image || data.resultUrl || data.result;
        if (!outputImageUrl) throw new Error('Image URL or Data was not returned by the server response.');
        setResultUrl(outputImageUrl);
      } else {
        const blob = await response.blob();
        setResultUrl(URL.createObjectURL(blob));
      }

      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser && typeof storedUser.credits === 'number') {
        storedUser.credits = Math.max(0, storedUser.credits - 1);
        localStorage.setItem('user', JSON.stringify(storedUser));
      }

    } catch (err) {
      setError(err.message || 'An error occurred during execution.');
    } finally {
      setLoading(false);
    }
  };

  const currentOutputUrl = activeTool === 'image-editor' ? editorPreviewUrl : resultUrl;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center font-sans text-slate-800">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Floating Tool Navigation Bar */}
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl p-1.5 mb-6 shadow-sm flex items-center justify-between gap-1 overflow-x-auto">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isSelected = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                setError('');
              }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap flex-1 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tool.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Card Container */}
      <div className="w-full max-w-6xl bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Preview Section */}
        <div className="lg:col-span-7 flex flex-col justify-center items-center relative min-h-[420px]">
          {previewUrl || currentOutputUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <ImageCompareSlider 
                originalUrl={previewUrl} 
                processedUrl={currentOutputUrl} 
                activeTool={activeTool} 
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 p-4 shadow-inner">
                <div className="p-3 bg-white rounded-full shadow-sm mb-2 border border-slate-100">
                  <activeToolObj.icon className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{activeToolObj.name}</span>
              </div>

              <div className="space-y-1.5 max-w-md">
                <h3 className="text-xl font-bold text-slate-900">
                  {activeToolObj.name} Workspace
                </h3>
                <p className="text-xs text-slate-500 font-normal leading-relaxed">
                  {activeToolObj.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Operations Panel */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-800 flex flex-col justify-between shadow-sm">
          <div className="space-y-5">
            
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <activeToolObj.icon className="w-4 h-4 text-blue-600" />
                <span className="text-slate-900 font-bold">{activeToolObj.name} Options</span>
              </h2>
            </div>

            {/* Source Image Upload Area */}
            {activeTool !== 'text-to-image' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Source Image
                </label>
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition group shadow-sm">
                  <PlusCircle className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition mb-2" />
                  <span className="text-xs font-semibold text-slate-700 text-center px-2 truncate max-w-full">
                    {selectedFile ? selectedFile.name : 'Click to Upload Image'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP up to 10MB</span>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </label>
              </div>
            )}

            {/* Image Expander Controls */}
            {activeTool === 'expand' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Expansion Ratio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['16:9', '9:16', '4:3', '1:1'].map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setExpandRatio(ratio)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition ${
                        expandRatio === ratio
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text-to-Image Controls */}
            {activeTool === 'text-to-image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Prompt Description
                  </label>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the image you want to generate in detail..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sample Inspiration
                  </label>
                  <div className="space-y-1.5">
                    {samplePrompts.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(sample)}
                        className="w-full text-left text-[11px] p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition text-slate-600 truncate flex items-center gap-1.5"
                      >
                        <Wand2 className="w-3 h-3 shrink-0 text-blue-500" />
                        <span className="truncate">{sample}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Image Editor Controls */}
            {activeTool === 'image-editor' && previewUrl && (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Brightness</span>
                    <span className="font-bold text-blue-600">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Contrast</span>
                    <span className="font-bold text-blue-600">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Saturation</span>
                    <span className="font-bold text-blue-600">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r - 90) % 360)}
                    className="flex items-center justify-center gap-1 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="flex items-center justify-center gap-1 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH((f) => !f)}
                    className={`flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-semibold transition ${
                      flipH ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV((f) => !f)}
                    className={`flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-semibold transition ${
                      flipV ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FlipVertical className="w-3.5 h-3.5" /> Flip V
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetEditor}
                  className="w-full flex items-center justify-center gap-1.5 p-2 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition mt-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Adjustments
                </button>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Control Buttons */}
          <div className="space-y-2 mt-6 border-t border-slate-200 pt-4">
            {activeTool !== 'image-editor' && (
              <button
                onClick={handleProcess}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <activeToolObj.icon className="w-4 h-4" />
                    <span>
                      {activeTool === 'remove-bg' && 'Remove Background'}
                      {activeTool === 'expand' && 'Expand Image'}
                      {activeTool === 'enhance' && 'Enhance Quality'}
                      {activeTool === 'text-to-image' && 'Generate Image'}
                    </span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={!currentOutputUrl}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download Image</span>
            </button>

            <button
              onClick={handleClearImage}
              type="button"
              className="w-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear / Reset</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}