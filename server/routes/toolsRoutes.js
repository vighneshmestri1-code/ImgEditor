const express = require('express');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const {
  protect,
  deductCredit,
} = require('../middleware/authMiddleware');

const {
  handleRemoveBg,
  handleTextToImage,
  handleEnhance,
  handleExpand,
} = require('../controllers/toolsController');

const router = express.Router();

// Keep upload processing before credit deduction.
router.post(
  '/remove-bg',
  protect,
  upload.single('image'),
  deductCredit,
  handleRemoveBg
);

router.post(
  '/text-to-image',
  protect,
  deductCredit,
  handleTextToImage
);

router.post(
  '/enhance',
  protect,
  upload.single('image'),
  deductCredit,
  handleEnhance
);

router.post(
  '/expand',
  protect,
  upload.single('image'),
  deductCredit,
  handleExpand
);

module.exports = router;