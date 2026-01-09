// server/services/storage.service.js
// Cloudflare R2 存储服务

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

// 配置 R2 客户端（兼容 S3 API）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

class StorageService {
  /**
   * 上传文件到 R2
   * @param {Buffer} fileBuffer - 文件内容
   * @param {string} originalName - 原始文件名
   * @param {string} mimeType - MIME 类型
   * @returns {Promise<{key: string, url: string}>}
   */
  static async uploadFile(fileBuffer, originalName, mimeType) {
    try {
      // 生成唯一文件名
      const fileExt = path.extname(originalName);
      const uniqueId = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const key = `audio/${timestamp}-${uniqueId}${fileExt}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
        },
      });

      await r2Client.send(command);

      // 生成访问 URL
      const url = process.env.R2_PUBLIC_URL 
        ? `${process.env.R2_PUBLIC_URL}/${key}`
        : await this.getSignedUrl(key, 3600 * 24 * 7); // 7天有效

      console.log(`✅ 文件上传成功: ${key}`);
      return { key, url };
    } catch (error) {
      console.error('❌ R2 上传失败:', error);
      throw new Error('文件上传失败: ' + error.message);
    }
  }

  /**
   * 生成临时访问 URL（签名 URL）
   * @param {string} key - 文件 key
   * @param {number} expiresIn - 过期时间（秒）
   * @returns {Promise<string>}
   */
  static async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(r2Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('❌ 生成签名 URL 失败:', error);
      throw new Error('生成访问链接失败');
    }
  }

  /**
   * 删除文件
   * @param {string} key - 文件 key
   */
  static async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await r2Client.send(command);
      console.log(`✅ 文件删除成功: ${key}`);
    } catch (error) {
      console.error('❌ R2 删除失败:', error);
      throw new Error('文件删除失败');
    }
  }

  /**
   * 获取文件流（用于流式播放）
   * @param {string} key - 文件 key
   */
  static async getFileStream(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);
      return response.Body;
    } catch (error) {
      console.error('❌ 获取文件流失败:', error);
      throw new Error('文件读取失败');
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} key - 文件 key
   * @returns {Promise<boolean>}
   */
  static async fileExists(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await r2Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = StorageService;