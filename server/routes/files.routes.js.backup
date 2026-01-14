// server/routes/files.routes.js
// 文件管理 API 路由

const express = require('express');
const multer = require('multer');
const FileService = require('../services/file.service');

const router = express.Router();

// Multer 配置（内存存储）
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
  }
});

// ==================== 认证中间件 ====================
// 注意：这个中间件需要放在路由文件中，因为 session 在这里可访问
function requireLogin(req, res, next) {
  console.log('🔐 检查认证 - Session:', req.session);
  console.log('🔐 User:', req.session?.user);
  
  if (!req.session || !req.session.user) {
    console.log('❌ 未授权 - 没有 session 或 user');
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized - Please login first' 
    });
  }
  
  console.log('✅ 认证通过 - User ID:', req.session.user.id);
  next();
}

// ==================== 路由 ====================

/**
 * 上传音频文件
 * POST /api/files/upload
 */
router.post('/upload', requireLogin, upload.single('audio'), async (req, res) => {
  console.log('📤 收到上传请求');
  console.log('📤 User:', req.session.user);
  console.log('📤 File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
  
  try {
    const userId = req.session.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    // 解析元数据（如果有）
    let metadata = {};
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch (e) {
        console.warn('⚠️ 解析元数据失败:', e);
      }
    }

    // 使用 FileService 上传到 R2
    const result = await FileService.uploadFile(file, userId, metadata);

    console.log('✅ 上传成功:', result);

    res.json({
      success: true,
      file: result,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('❌ 上传失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
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

    res.json(files);
  } catch (error) {
    console.error('❌ 获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get files'
    });
  }
});

/**
 * 获取单个文件详情
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
    console.error('❌ 获取文件详情失败:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file'
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

    const fileData = await FileService.downloadFile(fileId, userId, isAdmin);

    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
    res.setHeader('Content-Type', fileData.mimetype || 'application/octet-stream');
    
    // 发送文件数据
    res.send(fileData.buffer);

  } catch (error) {
    console.error('❌ 下载文件失败:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
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

    const result = await FileService.deleteFile(fileId, userId, isAdmin);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ 删除文件失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete file'
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

    const result = await FileService.updateMetadata(fileId, metadata, userId, isAdmin);

    res.json({
      success: true,
      file: result,
      message: 'Metadata updated successfully'
    });

  } catch (error) {
    console.error('❌ 更新元数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update metadata'
    });
  }
});

/**
 * 获取用户统计
 * GET /api/files/stats/me
 */
router.get('/stats/me', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const stats = await FileService.getUserStats(userId);

    res.json(stats);

  } catch (error) {
    console.error('❌ 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats'
    });
  }
});

module.exports = router;