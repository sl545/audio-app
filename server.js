require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const app = express();
const PORT = process.env.PORT || 3000;
// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
pool.on('connect', () => {
  console.log('Database connected');
});
pool.on('error', (err) => {
  console.error('Database error:', err);
});
// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
    domain: 'localhost',
  },
  name: 'audio.sid',
  rolling: true,
  store: undefined,
}));
// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    session: req.sessionID,
    user: req.session?.user?.username,
  });
  next();
});
// R2 Configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});
// Auth middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};
// Register
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, hashedPassword, email || null, 'user']
    );
    const newUser = result.rows[0];
    console.log('New user registered:', newUser.username);
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session error:', err);
        return res.status(500).json({ success: false, message: 'Session error' });
      }
      req.session.user = {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      };
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: 'Session save error' });
        }
        res.json({
          success: true,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
          },
        });
      });
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, email, role FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session error:', err);
        return res.status(500).json({ success: false, message: 'Session error' });
      }
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: 'Session save error' });
        }
        console.log('User logged in:', user.username, 'Session:', req.sessionID);
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Logout
app.post('/api/logout', (req, res) => {
  const username = req.session?.user?.username;
  const sessionId = req.sessionID;
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.clearCookie('audio.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    console.log('User logged out:', username, 'Session:', sessionId);
    res.json({ success: true, message: 'Logged out successfully' });
  });
});
// Get current user
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({
      success: true,
      user: req.session.user,
    });
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
});
// Upload file
app.post('/api/files/upload', requireLogin, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  try {
    const file = req.file;
    const userId = req.session.user.id;
    const filename = `${Date.now()}-${file.originalname}`;
    const key = `uploads/${userId}/${filename}`;
    console.log('Uploading to R2:', filename, 'Size:', file.size);
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    const r2Url = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log('R2 upload success:', r2Url);
    const result = await pool.query(
      'INSERT INTO files (filename, url, size, mimetype, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [filename, r2Url, file.size, file.mimetype, userId]
    );
    const savedFile = result.rows[0];
    console.log('Database save success:', savedFile.id);
    res.json({
      success: true,
      file: savedFile,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
});
// Get files list
app.get('/api/files', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    let query;
    let params;
    if (isAdmin) {
      query = `
        SELECT f.*, u.username as owner_username
        FROM files f
        LEFT JOIN users u ON f.user_id = u.id
        ORDER BY f.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT f.*, u.username as owner_username
        FROM files f
        LEFT JOIN users u ON f.user_id = u.id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `;
      params = [userId];
    }
    const result = await pool.query(query, params);
    const filesWithProxyUrl = result.rows.map(file => ({
      ...file,
      url: `/api/files/${file.id}/stream`,
      originalUrl: file.url,
    }));
    res.json({
      success: true,
      files: filesWithProxyUrl,
    });
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json({ success: false, message: 'Failed to get files' });
  }
});
// Stream audio
app.get('/api/files/:id/stream', requireLogin, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const file = result.rows[0];
    if (!isAdmin && file.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    console.log('Streaming file:', fileId, 'User:', req.session.user.username);
    const r2Url = file.url;
    const key = r2Url.split('.com/')[1];
    console.log('Fetching from R2:', key);
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const r2Response = await s3Client.send(command);
    const stream = r2Response.Body;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log('R2 download success, size:', buffer.length);
    res.set({
      'Content-Type': file.mimetype || 'audio/webm',
      'Content-Length': buffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    });
    console.log('Streaming started');
    res.send(buffer);
  } catch (err) {
    console.error('Stream error:', err);
    res.status(500).json({ success: false, message: 'Stream failed', error: err.message });
  }
});
// Download file
app.get('/api/files/:id/download', requireLogin, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const file = result.rows[0];
    if (!isAdmin && file.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    console.log('Download request:', fileId);
    const key = file.url.split('.com/')[1];
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    const r2Response = await s3Client.send(command);
    const stream = r2Response.Body;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    res.set({
      'Content-Type': file.mimetype || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length': buffer.length,
    });
    console.log('Download complete');
    res.send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ success: false, message: 'Download failed', error: err.message });
  }
});
// Delete file
app.delete('/api/files/:id', requireLogin, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const file = result.rows[0];
    if (!isAdmin && file.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    console.log('Delete request:', fileId, 'User:', req.session.user.username);
    const key = file.url.split('.com/')[1];
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
    console.log('R2 file deleted:', key);
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);
    console.log('Database record deleted');
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Delete failed', error: err.message });
  }
});
// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});
// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large (max 50MB)' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});
// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});
// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('Server running at:');
  console.log(`  http://localhost:${PORT}`);
  console.log('========================================');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
  console.log('R2 Storage:', process.env.R2_BUCKET_NAME || 'Not configured');
  console.log('========================================');
});
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await pool.end();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await pool.end();
  process.exit(0);
});
