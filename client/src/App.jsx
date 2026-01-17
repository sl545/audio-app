import React, { useEffect, useState, useRef } from 'react';
import Recorder from './components/Recorder';
import Waveform from './components/Waveform';
import AudioAnalysis from './components/AudioAnalysis';
import AudioFilter from './components/AudioFilter';
import FileUploader from './components/FileUploader';
import { AudioContextProvider } from './components/AudioContextProvider';

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
    if (data.success) {
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
        console.log('📁 Files response:', data);
        
        // Handle different response formats
        let fileList;
        if (Array.isArray(data)) {
          fileList = data;
        } else if (data.success && Array.isArray(data.files)) {
          fileList = data.files;
        } else {
          throw new Error('Invalid response format');
        }
        
        console.log('📁 Processed file list:', fileList);
        setFiles(fileList);
        setError(null);
      })
      .catch(err => {
        console.error('Error fetching files:', err);
        setError('Failed to load file list');
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
    await fetch('/api/logout', { 
      method: 'POST',
      credentials: 'include'
    });
    setUser(null);
    setFiles([]);
    setSelectedFile(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return;
    
    const res = await fetch(`/api/files/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (res.ok) {
      fetchFiles();
      if (selectedFile && selectedFile.id === id) {
        setSelectedFile(null);
      }
    } else {
      alert('Delete failed');
    }
  };

  const handleDownload = async (id, filename) => {
    try {
      const res = await fetch(`/api/files/${id}/download`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Auth screen
  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authForm}>
          <h1 style={styles.authTitle}>
            {mode === 'login' ? '🎵 Login' : '🎵 Register'}
          </h1>
          
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            style={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
          />
          
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
          />
          
          <button onClick={handleAuth} style={styles.authButton}>
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
          
          <div style={styles.toggleMode}>
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <span onClick={() => setMode('register')} style={styles.link}>
                  Register
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span onClick={() => setMode('login')} style={styles.link}>
                  Login
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>🎵 Audio Analysis Platform</h1>
        <div style={styles.headerActions}>
          <span style={styles.username}>👤 {user.username}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Left Column - Files */}
        <div style={styles.leftColumn}>
          {/* Upload Section */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📤 Upload Audio</h2>
            <FileUploader onUploadSuccess={fetchFiles} />
          </div>

          {/* Record Section */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>🎤 Record Audio</h2>
            <Recorder onUploadSuccess={fetchFiles} />
          </div>

          {/* Files List */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📁 My Files ({files.length})</h2>
            
            {error && (
              <div style={styles.errorMessage}>{error}</div>
            )}
            
            {files.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📭</div>
                <p>No files yet</p>
                <p style={styles.emptyHint}>Upload or record your first audio file</p>
              </div>
            ) : (
              <div style={styles.filesList}>
                {files.map((file) => (
                  <div 
                    key={file.id} 
                    style={{
                      ...styles.fileItem,
                      ...(selectedFile && selectedFile.id === file.id ? styles.fileItemSelected : {})
                    }}
                    onClick={() => {
                      console.log('🎵 Selected file:', file);
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
                          console.log('▶️ Play file:', file);
                          setSelectedFile(file);
                        }}
                        style={styles.iconButton}
                        title="Play"
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
                        title="Download"
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
                        title="Delete"
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
                    console.error('❌ Audio loading error:', e);
                    console.error('URL:', selectedFile.url);
                    alert('Audio loading failed, please check backend logs');
                  }}
                  onLoadedMetadata={() => {
                    console.log('✅ Audio loaded successfully');
                  }}
                />
                
                <div style={styles.fileInfo}>
                  <div><strong>File Size:</strong> {formatSize(selectedFile.size)}</div>
                  <div><strong>Upload Time:</strong> {formatDate(selectedFile.upload_time || selectedFile.created_at)}</div>
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

              {/* 🔥 WRAPPED WITH SHARED CONTEXT PROVIDER */}
              <AudioContextProvider audioRef={audioRef.current}>
                {/* Audio Filter */}
                <AudioFilter audioRef={audioRef.current} />
                
                {/* Audio Analysis */}
                <AudioAnalysis audioRef={audioRef.current} />
              </AudioContextProvider>
            </>
          ) : (
            <div style={styles.card}>
              <div style={styles.placeholder}>
                <div style={styles.placeholderIcon}>🎵</div>
                <h3>Select a file to start playing</h3>
                <p>Click any file in the list on the left</p>
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
  authButton: {
    width: '100%',
    padding: '1rem',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  toggleMode: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.95rem',
    color: '#666',
  },
  link: {
    color: '#667eea',
    cursor: 'pointer',
    fontWeight: '600',
  },

  // App Styles
  appContainer: {
    minHeight: '100vh',
    background: '#f5f5f5',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '1.5rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: '700',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  username: {
    fontSize: '1rem',
    fontWeight: '500',
  },
  logoutButton: {
    padding: '0.625rem 1.25rem',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '2px solid white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.3s',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '2rem',
    padding: '2rem',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  card: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1.25rem',
    color: '#333',
    fontWeight: '600',
  },
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
  },
  errorMessage: {
    padding: '1rem',
    background: '#fee',
    color: '#c33',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#999',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  emptyHint: {
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
  filesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '600px',
    overflowY: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid transparent',
  },
  fileItemSelected: {
    background: '#e7f3ff',
    borderColor: '#667eea',
  },
  fileIcon: {
    fontSize: '1.5rem',
    marginRight: '1rem',
  },
  fileDetails: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    background: 'white',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
  },
  iconButtonDanger: {
    padding: '0.5rem',
    background: 'white',
    border: '2px solid #fee',
    color: '#c33',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
  },
  placeholder: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: '#999',
  },
  placeholderIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
};

export default App;