const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('@octokit/rest');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authenticate);

// Local upload fallback directory
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

async function uploadToGitHub(buffer, filename) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, IMAGE_BASE_URL } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('GitHub not configured');
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const filePath = `opentodo/${filename}`;
  const content = buffer.toString('base64');

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    message: `Upload ${filename}`,
    content,
  });

  const baseUrl =
    IMAGE_BASE_URL ||
    `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main`;
  return `${baseUrl}/${filePath}`;
}

function uploadToLocal(buffer, filename) {
  const dest = path.join(LOCAL_UPLOAD_DIR, filename);
  fs.writeFileSync(dest, buffer);
  // Return a server-relative URL; the server serves /uploads/* as static
  return `/uploads/${filename}`;
}

router.post(
  '/image',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({ message: req.t('upload.unsupportedFormat') });
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      const url = await uploadToGitHub(req.file.buffer, filename);
      console.log(`[Upload] GitHub: ${url}`);
      return res.json({ url, storage: 'github' });
    } catch (githubErr) {
      console.warn(`[Upload] GitHub failed (${githubErr.message}), falling back to local storage`);
      const url = uploadToLocal(req.file.buffer, filename);
      console.log(`[Upload] Local: ${url}`);
      return res.json({ url, storage: 'local' });
    }
  })
);

module.exports = router;
