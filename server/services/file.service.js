// server/services/file.service.js
// 文件管理服务 - 处理文件的业务逻辑

const { Pool } = require('pg');
const StorageService = require('./storage.service');

// 数据库连接
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

class FileService {
  /**
   * 上传文件到 R2 并保存记录到数据库
   */
  static async uploadFile(file, userId, metadata = {}) {
    try {
      console.log('📤 FileService: 开始处理上传');
      
      // 1. 生成唯一文件名
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;
      
      console.log('📤 生成文件名:', filename);
      
      // 2. 上传到 R2
      const url = await StorageService.uploadToR2(file.buffer, filename);
      
      console.log('📤 R2 上传成功:', url);
      
      // 3. 保存到数据库
      const result = await db.query(`
        INSERT INTO files (filename, url, mimetype, size, user_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        file.originalname,
        url,
        file.mimetype,
        file.size,
        userId,
        JSON.stringify(metadata)
      ]);
      
      console.log('✅ 数据库保存成功');
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ FileService 上传失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的文件列表
   */
  static async getFilesByUser(userId, isAdmin = false) {
    try {
      console.log('📋 获取文件列表 - User ID:', userId, 'Admin:', isAdmin);
      
      const query = isAdmin
        ? `SELECT 
             files.id, 
             files.filename, 
             files.url, 
             files.mimetype, 
             files.size,
             files.created_at as upload_time,
             files.user_id,
             users.username
           FROM files 
           LEFT JOIN users ON files.user_id = users.id
           ORDER BY files.created_at DESC`
        
        : `SELECT 
             files.id, 
             files.filename, 
             files.url, 
             files.mimetype, 
             files.size,
             files.created_at as upload_time
           FROM files
           WHERE files.user_id = $1
           ORDER BY files.created_at DESC`;
      
      const params = isAdmin ? [] : [userId];
      const result = await db.query(query, params);
      
      console.log('✅ 找到', result.rows.length, '个文件');
      
      return result.rows;
      
    } catch (error) {
      console.error('❌ 获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个文件详情
   */
  static async getFileById(fileId, userId, isAdmin = false) {
    try {
      const query = isAdmin
        ? `SELECT * FROM files WHERE id = $1`
        : `SELECT * FROM files WHERE id = $1 AND user_id = $2`;
      
      const params = isAdmin ? [fileId] : [fileId, userId];
      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ 获取文件详情失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  static async downloadFile(fileId, userId, isAdmin = false) {
    try {
      // 1. 获取文件信息
      const file = await this.getFileById(fileId, userId, isAdmin);
      
      if (!file) {
        throw new Error('文件不存在或无权限访问');
      }
      
      // 2. 从 R2 下载
      const buffer = await StorageService.downloadFromR2(file.url);
      
      return {
        filename: file.filename,
        mimetype: file.mimetype,
        buffer: buffer,
      };
      
    } catch (error) {
      console.error('❌ 下载文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  static async deleteFile(fileId, userId, isAdmin = false) {
    try {
      console.log('🗑️ 删除文件 - ID:', fileId);
      
      // 1. 查询文件信息
      const file = await this.getFileById(fileId, userId, isAdmin);
      
      if (!file) {
        throw new Error('文件不存在或无权限删除');
      }
      
      console.log('🗑️ 找到文件:', file.filename);
      
      // 2. 从 R2 删除
      try {
        await StorageService.deleteFromR2(file.url);
        console.log('✅ R2 文件已删除');
      } catch (error) {
        console.warn('⚠️ R2 删除失败，继续删除数据库记录', error.message);
      }
      
      // 3. 从数据库删除
      await db.query('DELETE FROM files WHERE id = $1', [fileId]);
      console.log('✅ 数据库记录已删除');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ 删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 更新文件元数据
   */
  static async updateMetadata(fileId, metadata, userId, isAdmin = false) {
    try {
      // 1. 检查权限
      const file = await this.getFileById(fileId, userId, isAdmin);
      
      if (!file) {
        throw new Error('文件不存在或无权限修改');
      }
      
      // 2. 更新元数据
      const result = await db.query(`
        UPDATE files 
        SET metadata = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [JSON.stringify(metadata), fileId]);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ 更新元数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计
   */
  static async getUserStats(userId) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_files,
          COALESCE(SUM(size), 0) as total_size
        FROM files
        WHERE user_id = $1
      `, [userId]);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('❌ 获取统计失败:', error);
      throw error;
    }
  }
}

module.exports = FileService;