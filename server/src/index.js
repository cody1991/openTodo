require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET is not set. Please configure it in your .env file.');
  process.exit(1);
}

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const { seed } = require('./db/seed');

const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const bookmarkCategoryRoutes = require('./routes/bookmarkCategories');
const bookmarkRoutes = require('./routes/bookmarks');
const shareRoutes = require('./routes/share');
const publicShareRoutes = require('./routes/publicShare');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bookmark-categories', bookmarkCategoryRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/public/share', publicShareRoutes);

// Serve locally uploaded images
const uploadsDir = require('path').join(__dirname, '../../data/uploads');
if (!require('fs').existsSync(uploadsDir)) require('fs').mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('/*path', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Run seed on startup
seed();

// Global error handler
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`[Server] TODO Server running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
