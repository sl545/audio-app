// server/services/file.service.js
// 文件业务逻辑服务

const { Pool } = require('pg');
const StorageService = require('./storage.service');

// 数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

class FileService {
  /**
   * 上传音频文件
   * @param {Object} file - Multer 文件对象
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 文件信息
   */
  static async uploadAudio(file, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 上传到 R2
      console.log(`📤 上传文件: ${file.originalname}`);
      const { key, url } = await StorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // 2. 保存元数据到数据库
      const query = `
        INSERT INTO audio_files 
        (user_id, filename, original_name, file_size, mime_type, storage_url, storage_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        userId,
        key,
        file.originalname,
        file.size,
        file.mimetype,
        url,
        key
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      const savedFile = result.rows[0];
      console.log(`✅ 文件上传成功: ID ${savedFile.id}`);
      
      return savedFile;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ 上传音频失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的所有文件
   * @param {number} userId - 用户 ID
   * @param {Object} options - 查询选项
   */
  static async getUserFiles(userId, options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      orderBy = 'created_at', 
      order = 'DESC' 
    } = options;

    const query = `
      SELECT 
        id, filename, original_name, file_size, 
        duration, mime_type, storage_url, 
        created_at, updated_at
      FROM audio_files
      WHERE user_id = $1
      ORDER BY ${orderBy} ${order}
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await pool.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ 获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有文件（管理员）
   */
  static async getAllFiles(options = {}) {
    const { limit = 50, offset = 0 } = options;

    const query = `
      SELECT 
        af.*,
        u.username,
        u.email
      FROM audio_files af
      JOIN users u ON af.user_id = u.id
      ORDER BY af.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    try {
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ 获取所有文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个文件详情
   * @param {number} fileId - 文件 ID
   * @param {number} userId - 用户 ID（用于权限检查）
   */
  static async getFileById(fileId, userId) {
    const query = `
      SELECT * FROM audio_files
      WHERE id = $1 AND (user_id = $2 OR is_public = true)
    `;

    try {
      const result = await pool.query(query, [fileId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('文件不存在或无权访问');
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ 获取文件详情失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {number} fileId - 文件 ID
   * @param {number} userId - 用户 ID
   * @param {boolean} isAdmin - 是否为管理员
   */
  static async deleteFile(fileId, userId, isAdmin = false) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 获取文件信息
      const query = isAdmin 
        ? 'SELECT * FROM audio_files WHERE id = $1'
        : 'SELECT * FROM audio_files WHERE id = $1 AND user_id = $2';
      
      const params = isAdmin ? [fileId] : [fileId, userId];
      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('文件不存在或无权删除');
      }

      const file = result.rows[0];

      // 2. 从 R2 删除文件
      await StorageService.deleteFile(file.storage_key);

      // 3. 从数据库删除记录（会级联删除 audio_analysis）
      await client.query('DELETE FROM audio_files WHERE id = $1', [fileId]);

      await client.query('COMMIT');
      console.log(`✅ 文件已删除: ${fileId}`);
      
      return { success: true, message: '文件已删除' };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ 删除文件失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新文件元数据
   */
  static async updateFileMetadata(fileId, userId, metadata) {
    const { duration, waveform_data } = metadata;

    const query = `
      UPDATE audio_files 
      SET duration = COALESCE($1, duration),
          waveform_data = COALESCE($2, waveform_data),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [duration, waveform_data, fileId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('文件不存在或无权修改');
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ 更新元数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户存储统计
   */
  static async getUserStats(userId) {
    const query = `
      SELECT 
        COUNT(*) as file_count,
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(SUM(duration), 0) as total_duration
      FROM audio_files
      WHERE user_id = $1
    `;

    try {
      const result = await pool.query(query, [userId]);
      const stats = result.rows[0];
      
      return {
        fileCount: parseInt(stats.file_count),
        totalSize: parseInt(stats.total_size),
        totalDuration: parseFloat(stats.total_duration),
        averageSize: stats.file_count > 0 
          ? parseInt(stats.total_size) / parseInt(stats.file_count)
          : 0
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = FileService;