import React, { useEffect, useState } from 'react';
import Recorder from './components/Recorder';
import Waveform from './components/Waveform';

function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [mode, setMode] = useState('login'); // 'login' or 'register'

  // 获取当前用户信息
  const fetchMe = async () => {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      setUser(data.user);
      fetchFiles();
    } else {
      setUser(null);
    }
  };

  // 获取文件列表
  const fetchFiles = () => {
    fetch('/api/files', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setFiles(data);
          setError(null);
        } else {
          throw new Error('Expected an array');
        }
      })
      .catch(err => {
        console.error('Error fetching files:', err);
        setError('You must log in to view files.');
        setFiles([]);
      });
  };

  useEffect(() => {
    fetchMe();
  }, []);

  // 登录或注册
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

  // 登出
  const handleLogout = async () => {
    await fetch('/api/logout', { credentials: 'include' });
    setUser(null);
    setFiles([]);
  };

  if (!user) {
    return (
      <div className="auth-form">
        <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
        <input
          type="text"
          placeholder="Username"
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        <button onClick={handleAuth}>
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
        <p>
          {mode === 'login' ? 'No account?' : 'Already have account?'}{' '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Welcome, {user.username}!</h1>
      <button onClick={handleLogout}>Logout</button>

      <Recorder onUploadSuccess={fetchFiles} />
      {/* 手动上传功能 */}
      <h2>Uploaded Files</h2>
      <input
        type="file"
        accept="audio/*"
        onChange={async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const formData = new FormData();
          formData.append('audio', file);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          const data = await res.json();
          if (data.success) {
            alert('Upload successful!');
            fetchFiles(); // 刷新文件列表
          } else {
            alert('Upload failed.');
          }
        }}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <h2>Files List</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {files.map(file => (
          <li key={file.id}>
            <strong>{file.name}</strong> — uploaded by <em>{file.username || 'unknown'}</em>

            <button
              onClick={() => setSelectedFileUrl(`/uploads/${file.name}`)}
              style={{ marginLeft: '10px' }}
            >
              ▶ Play
            </button>

            <a
              href={`/uploads/${file.name}`}
              download
              style={{ marginLeft: '10px' }}
            >
              ⬇ Download
            </a>

            <button
              onClick={() => {
                fetch(`/api/files/${file.id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                }).then(() => {
                  setSelectedFileUrl(null);
                  fetchFiles();
                });
              }}
              style={{ marginLeft: '10px', color: 'red' }}
            >
              ❌ Delete
            </button>
          </li>
        ))}
      </ul>


      {selectedFileUrl && (
        <div>
          <h3>Waveform</h3>
          <Waveform audioUrl={selectedFileUrl} />
        </div>
      )}
    </div>
  );
}

export default App;
