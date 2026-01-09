// client/src/services/fileService.js
// 前端文件上传和管理服务

const API_BASE = '/api/files';

class FileService {
  /**
   * 上传文件到 R2（新方法 - 用于 Recorder 组件）
   * @param {Blob} blob - 音频 Blob
   * @param {Object} options - 上传选项
   * @param {string} options.filename - 文件名
   * @param {Object} options.metadata - 元数据
   * @returns {Promise<Object>} 上传结果
   */
  static async uploadFile(blob, options = {}) {
    const { filename, metadata = {} } = options;

    const formData = new FormData();
    formData.append('audio', blob, filename || `audio-${Date.now()}.webm`);

    // 添加元数据（如果有）
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // 包含 session cookie
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `上传失败: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('上传错误:', error);
      throw error;
    }
  }

  /**
   * 上传音频文件（原有方法 - 带进度）
   * @param {File|Blob} audioFile - 音频文件
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>}
   */
  static async uploadAudio(audioFile, onProgress) {
    const formData = new FormData();
    formData.append('audio', audioFile);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(Math.round(percentComplete));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || xhr.statusText));
          } catch {
            reject(new Error(xhr.statusText));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('上传失败')));
      xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

      xhr.open('POST', `${API_BASE}/upload`);
      xhr.send(formData);
    });
  }

  /**
   * 获取文件列表
   * @param {Object} params - 查询参数
   */
  static async getFiles(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE}${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('获取文件列表失败');
    }

    return response.json();
  }

  /**
   * 获取单个文件详情
   */
  static async getFileById(fileId) {
    const response = await fetch(`${API_BASE}/${fileId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('获取文件详情失败');
    }

    return response.json();
  }

  /**
   * 删除文件
   */
  static async deleteFile(fileId) {
    const response = await fetch(`${API_BASE}/${fileId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('删除文件失败');
    }

    return response.json();
  }

  /**
   * 更新文件元数据
   */
  static async updateMetadata(fileId, metadata) {
    const response = await fetch(`${API_BASE}/${fileId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new Error('更新元数据失败');
    }

    return response.json();
  }

  /**
   * 获取用户统计
   */
  static async getUserStats() {
    const response = await fetch(`${API_BASE}/stats/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('获取统计信息失败');
    }

    return response.json();
  }

  /**
   * 获取文件下载 URL
   * @param {number|string} fileId - 文件 ID
   * @returns {string} 下载 URL
   */
  static getDownloadUrl(fileId) {
    return `${API_BASE}/${fileId}/download`;
  }

  /**
   * 获取文件播放 URL（带认证）
   * @param {string} url - R2 URL 或文件 ID
   * @returns {string} 播放 URL
   */
  static getPlayUrl(url) {
    // 如果已经是完整 URL（R2），直接返回
    if (url && url.startsWith('http')) {
      return url;
    }
    // 否则使用下载端点
    return this.getDownloadUrl(url);
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 格式化时长
   */
  static formatDuration(seconds) {
    if (!seconds) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export default FileService;