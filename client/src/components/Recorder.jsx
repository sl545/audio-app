import React, { useState } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import FileService from '../services/fileService';

export default function Recorder({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error: recordingError,
  } = useAudioRecorder();

  // 上传到 R2
  const handleUpload = async () => {
    if (!audioBlob) {
      setUploadError('没有可上传的录音');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // 使用 FileService 上传到 R2
      const result = await FileService.uploadFile(audioBlob, {
        filename: `recording-${Date.now()}.webm`,
        metadata: {
          duration: recordingTime,
          recordedAt: new Date().toISOString(),
        },
      });

      console.log('✅ 上传到 R2 成功:', result);
      
      // 通知父组件刷新文件列表
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // 可选：清除本地 blob（如果需要）
      // 但保留它可以让用户重复上传
      
    } catch (err) {
      console.error('❌ 上传失败:', err);
      setUploadError(err.message || '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  // 格式化录音时长
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recorder-container">
      {/* 录音控制 */}
      <div className="recorder-controls">
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="btn-primary"
            disabled={uploading}
          >
            🎤 开始录音
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button 
                onClick={pauseRecording}
                className="btn-warning"
              >
                ⏸️ 暂停
              </button>
            ) : (
              <button 
                onClick={resumeRecording}
                className="btn-success"
              >
                ▶️ 继续
              </button>
            )}
            <button 
              onClick={stopRecording}
              className="btn-danger"
            >
              ⏹️ 停止录音
            </button>
          </>
        )}
      </div>

      {/* 录音时长显示 */}
      {isRecording && (
        <div className="recording-time">
          ⏱️ {formatTime(recordingTime)}
          {isPaused && <span className="paused-indicator"> (已暂停)</span>}
        </div>
      )}

      {/* 录音完成后显示上传按钮 */}
      {audioBlob && !isRecording && (
        <div className="upload-section">
          <div className="audio-preview">
            <audio 
              src={URL.createObjectURL(audioBlob)} 
              controls 
              style={{ width: '100%', marginBottom: '1em' }}
            />
          </div>
          
          <button 
            onClick={handleUpload}
            disabled={uploading}
            className="btn-upload"
          >
            {uploading ? '⏳ 上传中...' : '☁️ 上传到云端'}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {recordingError && (
        <div className="error-message">
          ❌ 录音错误: {recordingError}
        </div>
      )}

      {uploadError && (
        <div className="error-message">
          ❌ 上传错误: {uploadError}
        </div>
      )}

      {/* 简单的内联样式（可以移到 CSS 文件） */}
      <style>{`
        .recorder-container {
          padding: 1em;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
        }

        .recorder-controls {
          display: flex;
          gap: 0.5em;
          margin-bottom: 1em;
        }

        .recorder-controls button {
          padding: 0.5em 1em;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1em;
          transition: opacity 0.2s;
        }

        .recorder-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-warning {
          background: #ffc107;
          color: #333;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-upload {
          background: #17a2b8;
          color: white;
          padding: 0.75em 1.5em;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1em;
          width: 100%;
        }

        .recording-time {
          font-size: 1.5em;
          font-weight: bold;
          text-align: center;
          padding: 0.5em;
          background: #fff;
          border-radius: 4px;
          margin-bottom: 1em;
        }

        .paused-indicator {
          color: #ffc107;
          font-size: 0.8em;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 0.75em;
          border-radius: 4px;
          margin-top: 1em;
        }

        .upload-section {
          margin-top: 1em;
          padding-top: 1em;
          border-top: 1px solid #ddd;
        }

        .audio-preview {
          margin-bottom: 1em;
        }
      `}</style>
    </div>
  );
}