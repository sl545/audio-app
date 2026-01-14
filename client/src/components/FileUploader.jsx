import React, { useState } from 'react';
import FileService from '../services/fileService';

/**
 * 文件上传组件
 * 支持手动选择音频文件上传
 */
function FileUploader({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) {
      setError('请选择有效的音频文件（webm, wav, mp3, ogg, m4a）');
      return;
    }

    // 验证文件大小（最大 50MB）
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过 50MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log('📤 开始上传文件:', file.name, '大小:', file.size, 'bytes');

      // 创建 FormData
      const formData = new FormData();
      formData.append('audio', file);

      // 上传
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ 上传成功:', data);
        setError(null);
        
        // 清空 input
        e.target.value = '';
        
        // 通知父组件刷新列表
        if (onUploadSuccess) {
          onUploadSuccess();
        }

        alert('上传成功！');
      } else {
        throw new Error(data.message || '上传失败');
      }

    } catch (err) {
      console.error('❌ 上传失败:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.uploadBox}>
        <div style={styles.icon}>📁</div>
        <h4 style={styles.title}>手动上传音频文件</h4>
        <p style={styles.description}>
          支持格式：WebM, WAV, MP3, OGG, M4A
          <br/>
          最大大小：50MB
        </p>

        <label htmlFor="file-upload" style={styles.uploadButton}>
          {uploading ? (
            <>
              <span style={styles.spinner}>⏳</span>
              上传中...
            </>
          ) : (
            <>
              <span style={styles.uploadIcon}>⬆️</span>
              选择文件上传
            </>
          )}
        </label>

        <input
          id="file-upload"
          type="file"
          accept="audio/*,.webm,.wav,.mp3,.ogg,.m4a"
          onChange={handleFileSelect}
          disabled={uploading}
          style={styles.fileInput}
        />

        {error && (
          <div style={styles.error}>
            ⚠️ {error}
          </div>
        )}

        {uploading && (
          <div style={styles.progress}>
            <div style={styles.progressBar}>
              <div style={styles.progressFill} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '1.5rem',
  },
  uploadBox: {
    padding: '2rem',
    background: '#f8f9fa',
    border: '2px dashed #ccc',
    borderRadius: '12px',
    textAlign: 'center',
    transition: 'all 0.3s',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  title: {
    margin: '0 0 0.5rem 0',
    color: '#333',
    fontSize: '1.1rem',
  },
  description: {
    margin: '0 0 1.5rem 0',
    color: '#666',
    fontSize: '0.9rem',
    lineHeight: '1.5',
  },
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 2rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  uploadIcon: {
    fontSize: '1.2rem',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  fileInput: {
    display: 'none',
  },
  error: {
    marginTop: '1rem',
    padding: '0.75rem',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  progress: {
    marginTop: '1rem',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    background: '#e9ecef',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    background: '#007bff',
    animation: 'progress 1.5s ease-in-out infinite',
  },
};

// 添加动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes progress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;
document.head.appendChild(styleSheet);

export default FileUploader;