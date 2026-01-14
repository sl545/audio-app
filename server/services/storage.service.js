// server/services/storage.service.js
// Cloudflare R2 存储服务

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// 配置 R2 客户端（兼容 S3 API）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

class StorageService {
  /**
   * 上传文件到 R2
   * @param {Buffer} buffer - 文件的二进制数据
   * @param {string} filename - 文件名
   * @returns {Promise<string>} 文件的公开访问 URL
   */
  static async uploadToR2(buffer, filename) {
    try {
      console.log('📦 StorageService: 开始上传到 R2');
      console.log('📦 文件名:', filename);
      console.log('📦 文件大小:', buffer.length, 'bytes');
      
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: this.getContentType(filename),
      });
      
      await r2Client.send(command);
      
      // 生成公开访问 URL
      const url = process.env.R2_PUBLIC_URL
        ? `${process.env.R2_PUBLIC_URL}/${filename}`
        : `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;
      
      console.log('✅ R2 上传成功:', url);
      
      return url;
      
    } catch (error) {
      console.error('❌ R2 上传失败:', error);
      throw new Error(`R2 上传失败: ${error.message}`);
    }
  }

  /**
   * 从 R2 下载文件
   * @param {string} url - 文件的 URL
   * @returns {Promise<Buffer>} 文件的二进制数据
   */
  static async downloadFromR2(url) {
    try {
      // 从 URL 提取文件名
      const filename = url.split('/').pop();
      
      console.log('📥 从 R2 下载文件:', filename);
      
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
      });
      
      const response = await r2Client.send(command);
      
      // 将 stream 转换为 buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      console.log('✅ R2 下载成功, 大小:', buffer.length, 'bytes');
      
      return buffer;
      
    } catch (error) {
      console.error('❌ R2 下载失败:', error);
      throw new Error(`R2 下载失败: ${error.message}`);
    }
  }

  /**
   * 从 R2 删除文件
   * @param {string} url - 文件的 URL
   * @returns {Promise<void>}
   */
  static async deleteFromR2(url) {
    try {
      // 从 URL 提取文件名
      const filename = url.split('/').pop();
      
      console.log('🗑️ 从 R2 删除文件:', filename);
      
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
      });
      
      await r2Client.send(command);
      
      console.log('✅ R2 文件已删除');
      
    } catch (error) {
      console.error('❌ R2 删除失败:', error);
      throw new Error(`R2 删除失败: ${error.message}`);
    }
  }

  /**
   * 生成预签名 URL（用于临时访问私有文件）
   * @param {string} filename - 文件名
   * @param {number} expiresIn - 过期时间（秒），默认 3600（1小时）
   * @returns {Promise<string>} 预签名 URL
   */
  static async getSignedUrl(filename, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
      });
      
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
      
      return signedUrl;
      
    } catch (error) {
      console.error('❌ 生成预签名 URL 失败:', error);
      throw new Error(`生成预签名 URL 失败: ${error.message}`);
    }
  }

  /**
   * 根据文件扩展名获取 Content-Type
   * @param {string} filename - 文件名
   * @returns {string} Content-Type
   */
  static getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const contentTypes = {
      'webm': 'audio/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'mp4': 'video/mp4',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = StorageService;