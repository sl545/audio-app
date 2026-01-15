import React, { useEffect, useState, useRef } from 'react';
import Recorder from './components/Recorder';
import Waveform from './components/Waveform';
import AudioAnalysis from './components/AudioAnalysis';
import FileUploader from './components/FileUploader';
import AudioFilter from './components/AudioFilter';
function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [mode, setMode] = useState('login');
  
  const audioRef = useRef(null);
  const fetchMe = async () => {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();
    if (data.success) {  // ← 改成 success
      setUser(data.user);
      fetchFiles();
    } else {
      setUser(null);
    }
  };
  const fetchFiles = () => {
    fetch('/api/files', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('📁 File List Raw Response:', data);
        
        // 处理两种可能的响应格式
        let fileList;
        if (Array.isArray(data)) {
          // 格式 1: 直接返回数组
          fileList = data;
        } else if (data.success && Array.isArray(data.files)) {
          // 格式 2: { success: true, files: [...] }
          fileList = data.files;
        } else {
          throw new Error('Invalid response format');
        }

        console.log('📁 File list after processing:', fileList);
        setFiles(fileList);
        setError(null);
      })
      .catch(err => {
        console.error('Error fetching files:', err);
        setError('Unable to load file list');
        setFiles([]);
      });
  };
  useEffect(() => {
    fetchMe();
  }, []);
  const handleAuth = async () => {
    const url = `/api/${mode}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      await fetchMe();
    } else {
      alert(data.message || 'Auth failed');
    }
  };
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { 
        method: 'POST',
        credentials: 'include' 
      });
      
      // 清除所有状态
      setUser(null);
      setFiles([]);
      setSelectedFile(null);
      setError(null);

      console.log('✅ Logout successfully');
    } catch (err) {
      console.error('❌ Logout failed:', err);
      // 即使失败也清除状态
      setUser(null);
      setFiles([]);
      setSelectedFile(null);
    }
  };
  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        alert('Deleted successfully');
        if (selectedFile && selectedFile.id === fileId) {
          setSelectedFile(null);
        }
        fetchFiles();
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed');
    }
  };
  // ⭐ 新增：下载文件函数
  const handleDownload = async (fileId, filename) => {
    try {
      const res = await fetch(`/api/files/${fileId}/download`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed');
    }
  };
  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authForm}>
          <h2 style={styles.authTitle}>{mode === 'login' ? '🎵 Login' : '🎵 Register'}</h2>
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            style={styles.input}
            onKeyPress={e => e.key === 'Enter' && handleAuth()}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            style={styles.input}
            onKeyPress={e => e.key === 'Enter' && handleAuth()}
          />
          <button onClick={handleAuth} style={styles.primaryButton}>
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
          <p style={styles.switchMode}>
            {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
            <span
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={styles.linkButton}
            >
              {mode === 'login' ? 'Register' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.mainTitle}>🎵 Audio Management System</h1>
        <div style={styles.userInfo}>
          <span style={styles.username}>Welcome, {user.username}</span>
          {user.role === 'admin' && <span style={styles.adminBadge}>Admin</span>}
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>
      {/* Main Content - Two Column Layout */}
      <div style={styles.mainContent}>
        {/* Left Column - Recorder and File List */}
        <div style={styles.leftColumn}>
          {/* Recorder Section */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>🎤 Recording and Upload</h2>
            
            {/* 录音功能 */}
            <Recorder onUploadSuccess={fetchFiles} />
            
            {/* 分隔线 */}
            <div style={styles.divider}>OR</div>
            
            {/* 文件上传 */}
            <FileUploader onUploadSuccess={fetchFiles} />
          </div>
          {/* File List Section */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📁 List of Files ({files.length})</h2>
            
            {error && <p style={styles.error}>{error}</p>}
            
            {files.length === 0 ? (
              <p style={styles.emptyMessage}>No files uploaded yet</p>
            ) : (
              <div style={styles.fileList}>
                {files.map(file => (
                  <div 
                    key={file.id} 
                    style={{
                      ...styles.fileItem,
                      ...(selectedFile && selectedFile.id === file.id ? styles.fileItemSelected : {})
                    }}
                    onClick={() => {
                      console.log('🎵 Choose files:', file);
                      setSelectedFile(file);
                    }}
                  >
                    <div style={styles.fileIcon}>🎵</div>
                    <div style={styles.fileDetails}>
                      <div style={styles.fileName}>{file.filename}</div>
                      <div style={styles.fileMeta}>
                        {formatSize(file.size)} • {formatDate(file.upload_time || file.created_at)}
                        {file.username && ` • ${file.username}`}
                      </div>
                    </div>
                    <div style={styles.fileActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('▶️ Display file:', file);
                          setSelectedFile(file);
                        }}
                        style={styles.iconButton}
                        title="播放"
                      >
                        {selectedFile && selectedFile.id === file.id ? '⏸' : '▶️'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownload(file.id, file.filename);
                        }}
                        style={styles.iconButton}
                        title="下载"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(file.id);
                        }}
                        style={styles.iconButtonDanger}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Right Column - Player and Analysis */}
        <div style={styles.rightColumn}>
          {selectedFile ? (
            <>
              {/* Player Section */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>🎧 {selectedFile.filename}</h2>
                
                <audio
                  ref={audioRef}
                  src={selectedFile.url}
                  controls
                  autoPlay
                  style={styles.audioPlayer}
                  onError={(e) => {
                    console.error('❌ 音频加载错误:', e);
                    console.error('URL:', selectedFile.url);
                    alert('音频加载失败，请检查后端日志');
                  }}
                  onLoadedMetadata={() => {
                    console.log('✅ 音频加载成功');
                  }}
                />
                
                <div style={styles.fileInfo}>
                  <div><strong>File size :</strong> {formatSize(selectedFile.size)}</div>
                  <div><strong>Upload time:</strong> {formatDate(selectedFile.upload_time || selectedFile.created_at)}</div>
                  {selectedFile.username && (
                    <div><strong>Uploader:</strong> {selectedFile.username}</div>
                  )}
                </div>
              </div>
              {/* Waveform Section */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>📊 Waveform</h3>
                <Waveform audioUrl={selectedFile.url} />
              </div>
              <AudioFilter audioRef={audioRef.current} />
              {/* Unified Audio Analysis */}
              <AudioAnalysis audioRef={audioRef.current} />
              {/* <AudioFilter audioRef={audioRef.current} /> */}
            </>
          ) : (
            <div style={styles.card}>
              <div style={styles.placeholder}>
                <div style={styles.placeholderIcon}>🎵</div>
                <h3>Choose a file to play</h3>
                <p>Click any file in the file list on the left.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
const styles = {
  // Auth Styles
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  authForm: {
    background: 'white',
    padding: '3rem',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '400px',
  },
  authTitle: {
    textAlign: 'center',
    marginBottom: '2rem',
    fontSize: '2rem',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '0.875rem',
    marginBottom: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s',
  },
  primaryButton: {
    width: '100%',
    padding: '1rem',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.3s',
  },
  linkButton: {
    color: '#667eea',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontWeight: '600',
  },
  switchMode: {
    marginTop: '1.5rem',
    textAlign: 'center',
    color: '#666',
  },
  // Main Layout
  container: {
    minHeight: '100vh',
    background: '#f5f7fa',
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    padding: '1.5rem 2rem',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  mainTitle: {
    margin: 0,
    fontSize: '1.75rem',
    color: '#333',
  },
  userInfo: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  username: {
    fontSize: '1rem',
    color: '#666',
  },
  adminBadge: {
    background: '#ffc107',
    color: '#333',
    padding: '0.375rem 0.875rem',
    borderRadius: '16px',
    fontSize: '0.875rem',
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: '0.625rem 1.25rem',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '500',
    transition: 'background 0.3s',
  },
  // Two Column Layout
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '450px 1fr',
    gap: '2rem',
    alignItems: 'start',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    minHeight: '600px',
  },
  // Card Styles
  card: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: '0 0 1.25rem 0',
    fontSize: '1.25rem',
    color: '#333',
    fontWeight: '600',
  },
  // File List
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '500px',
    overflowY: 'auto',
    padding: '0.5rem',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  fileItemSelected: {
    background: '#e7f3ff',
    borderColor: '#667eea',
  },
  fileIcon: {
    fontSize: '2rem',
  },
  fileDetails: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontWeight: '600',
    marginBottom: '0.25rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileMeta: {
    fontSize: '0.8rem',
    color: '#666',
  },
  fileActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  iconButton: {
    padding: '0.5rem',
    background: '#f0f0f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background 0.2s',
  },
  iconButtonDanger: {
    padding: '0.5rem',
    background: '#ffe0e0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background 0.2s',
  },
  // Player
  audioPlayer: {
    width: '100%',
    marginBottom: '1rem',
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: '#666',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
  },
  // Placeholder
  placeholder: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: '#999',
  },
  placeholderIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  // Messages
  error: {
    color: '#dc3545',
    padding: '1rem',
    background: '#f8d7da',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
    padding: '2rem',
  },
  divider: {
    margin: '1.5rem 0',
    padding: '0.75rem',
    textAlign: 'center',
    color: '#999',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
};
export default App;
