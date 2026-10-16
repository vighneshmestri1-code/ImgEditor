const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const { InferenceClient } = require('@huggingface/inference');

// Initialize Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: false
});

// 1. Remove Background (Exported as handleRemoveBg to match toolsRoutes.js)
exports.handleRemoveBg = async (req, res) => {
  try {
    const apiKey = process.env.REMOVE_BG_API_KEY;

    if (!apiKey) {
      console.error('SERVER ERROR: REMOVE_BG_API_KEY is missing in .env');
      return res.status(500).json({
        error: 'Remove BG service configuration error: REMOVE_BG_API_KEY is missing in server .env'
      });
    }

    const formData = new FormData();
    formData.append('size', 'auto');

    // Handle file upload via multer or base64 input
    if (req.file) {
      formData.append('image_file', req.file.buffer, {
        filename: req.file.originalname || 'upload.png',
        contentType: req.file.mimetype,
      });
    } else if (req.body.image) {
      // If passing base64 string
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      formData.append('image_file_b64', base64Data);
    } else if (req.body.imageUrl) {
      formData.append('image_url', req.body.imageUrl);
    } else {
      return res.status(400).json({ error: 'No image provided for background removal' });
    }

    // Call official Remove.bg API
    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': apiKey,
      },
      responseType: 'arraybuffer', // Remove.bg returns binary PNG data
    });

    // Convert binary buffer -> Base64 Data URL for frontend rendering
    const base64Image = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return res.status(200).json({ url: dataUrl });

  } catch (error) {
    console.error('Remove.bg API Error:', error.response ? error.response.data.toString() : error.message);

    if (error.response && error.response.status === 402) {
      return res.status(402).json({ error: 'Remove.bg API credits depleted.' });
    }

    return res.status(500).json({
      error: 'Failed to remove background using Remove.bg API'
    });
  }
};

// Also export alias if needed elsewhere
exports.handleRemoveBackground = exports.handleRemoveBg;

// 2. Text To Image
exports.handleTextToImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A valid text prompt is required' });
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      console.error('SERVER ERROR: HF_TOKEN is missing in .env');
      return res.status(500).json({ error: 'HF_TOKEN missing in server .env' });
    }

    const client = new InferenceClient(hfToken);

    // Use FLUX.1-schnell model on Hugging Face
    const imageBlob = await client.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: prompt.trim(),
    });

    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const contentType = imageBlob.type || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    return res.status(200).json({ url: dataUrl });

  } catch (error) {
    console.error('Hugging Face Inference Error:', error.message || error);
    return res.status(500).json({
      error: error.message || 'Failed to generate image via Hugging Face'
    });
  }
};

// 3. Quality Enhancer
exports.handleEnhance = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const scaleFactor = req.body.scale === '4x' ? 4 : 2;
    const isUltraMode = req.body.mode === 'AI Ultra Sharp';

    const metadata = await sharp(req.file.buffer).metadata();
    const targetWidth = Math.round((metadata.width || 800) * scaleFactor);
    const targetHeight = Math.round((metadata.height || 600) * scaleFactor);

    let pipeline = sharp(req.file.buffer)
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: false
      });

    if (isUltraMode) {
      pipeline = pipeline
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.5 })
        .modulate({ saturation: 1.05, brightness: 1.02 })
        .clahe({ width: 10, height: 10 });
    } else {
      pipeline = pipeline.sharpen({ sigma: 1.0 });
    }

    const enhancedBuffer = await pipeline.png().toBuffer();

    const base64Image = enhancedBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return res.status(200).json({ url: dataUrl });
  } catch (error) {
    console.error('Error in handleEnhance:', error.message || error);
    return res.status(500).json({ error: 'Failed to enhance image' });
  }
};

// 4. Image Expander (Clipdrop AI Uncrop with Automatic Fallback)
exports.handleExpand = async (req, res) => {
  // Store calculation parameters outside try block so fallback can access them
  let targetW, targetH, inputBuffer;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const apiKey = process.env.CLIPDROP_API_KEY;

    // 1. Calculate aspect ratio dimensions
    const ratioStr = req.body.aspectRatio || '1:1';
    let ratioW = 1;
    let ratioH = 1;

    if (ratioStr === '16:9') { ratioW = 16; ratioH = 9; }
    else if (ratioStr === '9:16') { ratioW = 9; ratioH = 16; }
    else if (ratioStr === '4:3') { ratioW = 4; ratioH = 3; }

    inputBuffer = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg()
      .toBuffer();

    const metadata = await sharp(inputBuffer).metadata();
    const origW = metadata.width || 800;
    const origH = metadata.height || 600;

    targetW = origW;
    targetH = origH;

    const currentRatio = origW / origH;
    const targetRatio = ratioW / ratioH;

    if (currentRatio < targetRatio) {
      targetW = Math.round(origH * targetRatio);
    } else {
      targetH = Math.round(origW / targetRatio);
    }

    const totalPadW = Math.max(0, targetW - origW);
    const totalPadH = Math.max(0, targetH - origH);

    const padLeft = Math.floor(totalPadW / 2);
    const padRight = Math.ceil(totalPadW / 2);
    const padUp = Math.floor(totalPadH / 2);
    const padDown = Math.ceil(totalPadH / 2);

    // 2. Attempt Clipdrop API if Key Exists
    if (apiKey) {
      const formData = new FormData();
      formData.append('image_file', inputBuffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      });

      formData.append('extend_left', String(padLeft));
      formData.append('extend_right', String(padRight));
      formData.append('extend_up', String(padUp));
      formData.append('extend_down', String(padDown));

      const response = await axios.post('https://clipdrop-api.co/uncrop/v1', formData, {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': apiKey,
        },
        responseType: 'arraybuffer',
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const base64Image = Buffer.from(response.data).toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      return res.status(200).json({ url: dataUrl });
    }
  } catch (error) {
    let errorDetails = error.message;
    if (error.response && error.response.data) {
      try {
        const jsonError = JSON.parse(Buffer.from(error.response.data).toString());
        errorDetails = jsonError.error || JSON.stringify(jsonError);
      } catch (e) {
        errorDetails = error.response.data.toString();
      }
    }
    console.warn('Clipdrop API unavailable/out of credits, using local fallback:', errorDetails);
  }

  // 3. Fallback: Sharp Blurred Background Canvas Expansion
  try {
    const bgBuffer = await sharp(req.file.buffer)
      .resize(targetW, targetH, { fit: 'cover' })
      .blur(40)
      .modulate({ brightness: 0.85 })
      .toBuffer();

    const expandedBuffer = await sharp(bgBuffer)
      .composite([{
        input: req.file.buffer,
        gravity: 'center'
      }])
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Image = expandedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    return res.status(200).json({ url: dataUrl });
  } catch (fallbackErr) {
    console.error('Fallback expansion error:', fallbackErr.message);
    return res.status(500).json({ error: 'Failed to expand image canvas' });
  }
};