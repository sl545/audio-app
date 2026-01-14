// server/routes/files.routes.js
// 文件路由 - 带音频代理功能

const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileService = require('../services/file.service');
const StorageService = require('../services/storage.service');

// Multer 配置（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// 认证中间件
const requireLogin = (req, res, next) => {
  console.log('🔐 检查认证 - Session:', req.session);
  console.log('🔐 User:', req.session.user);
  
  if (!req.session || !req.session.user) {
    console.log('❌ 未授权 - 没有 session 或 user');
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized' 
    });
  }
  
  console.log('✅ 认证通过 - User ID:', req.session.user.id);
  next();
};

/**
 * 上传文件
 * POST /api/files/upload
 */
router.post('/upload', requireLogin, upload.single('audio'), async (req, res) => {
  try {
    console.log('📤 收到上传请求');
    console.log('📤 User:', req.session.user);
    console.log('📤 File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const userId = req.session.user.id;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    
    const file = await FileService.uploadFile(req.file, userId, metadata);
    
    console.log('✅ 上传成功:', file);
    
    res.json({ 
      success: true, 
      file 
    });
    
  } catch (error) {
    console.error('❌ 上传失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * 获取文件列表
 * GET /api/files
 */
router.get('/', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    
    const files = await FileService.getFilesByUser(userId, isAdmin);
    
    // 替换 URL 为代理 URL
    const filesWithProxyUrl = files.map(file => ({
      ...file,
      url: `/api/files/${file.id}/stream`,  // ⭐ 使用代理 URL
      originalUrl: file.url  // 保留原始 URL 以备后用
    }));
    
    res.json(filesWithProxyUrl);
    
  } catch (error) {
    console.error('❌ 获取文件列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * ⭐ 新增：流式传输音频文件（代理）
 * GET /api/files/:id/stream
 */
router.get('/:id/stream', requireLogin, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    
    console.log('🎵 流式传输请求 - File ID:', fileId);
    
    // 获取文件信息
    const file = await FileService.getFileById(fileId, userId, isAdmin);
    
    if (!file) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }
    
    console.log('🎵 从 R2 获取文件:', file.filename);
    
    // 从 R2 下载文件
    const buffer = await StorageService.downloadFromR2(file.url);
    
    // 设置响应头
    res.set({
      'Content-Type': file.mimetype || 'audio/webm',
      'Content-Length': buffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000', // 缓存 1 年
    });
    
    console.log('✅ 开始传输, 大小:', buffer.length, 'bytes');
    
    // 发送文件
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ 流式传输失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * 获取单个文件信息
 * GET /api/files/:id
 */
router.get('/:id', requireLogin, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    
    const file = await FileService.getFileById(fileId, userId, isAdmin);
    
    if (!file) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }
    
    res.json(file);
    
  } catch (error) {
    console.error('❌ 获取文件失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * 下载文件
 * GET /api/files/:id/download
 */
router.get('/:id/download', requireLogin, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    
    const result = await FileService.downloadFile(fileId, userId, isAdmin);
    
    res.set({
      'Content-Type': result.mimetype,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
    
    res.send(result.buffer);
    
  } catch (error) {
    console.error('❌ 下载失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * 删除文件
 * DELETE /api/files/:id
 */
router.delete('/:id', requireLogin, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    
    await FileService.deleteFile(fileId, userId, isAdmin);
    
    res.json({ 
      success: true,
      message: 'File deleted successfully' 
    });
    
  } catch (error) {
    console.error('❌ 删除失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * 更新文件元数据
 * PATCH /api/files/:id/metadata
 */
router.patch('/:id/metadata', requireLogin, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const metadata = req.body;
    
    const file = await FileService.updateMetadata(fileId, metadata, userId, isAdmin);
    
    res.json({ 
      success: true, 
      file 
    });
    
  } catch (error) {
    console.error('❌ 更新元数据失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;