import React, { useRef, useState } from 'react';

export default function Recorder({ onUploadSuccess }) {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    try {
      // Reset states
      setAudioURL(null);
      setAudioBlob(null);
      setUploadSuccess(false);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        setAudioURL(url);
        setAudioBlob(blob);
        
        console.log('✅ Recording completed, size:', blob.size, 'bytes');
      };
      
      audioChunks.current = [];
      mediaRecorderRef.current.start();
      setRecording(true);
      
    } catch (err) {
      console.error('❌ Recording error:', err);
      setError('Failed to start recording. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      setRecording(false);
    }
  };

  const uploadToCloud = async () => {
    if (!audioBlob || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      const filename = `recording-${Date.now()}.webm`;
      formData.append('audio', audioBlob, filename);

      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      // Success/Error handling
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            console.log('✅ Upload successful:', data.file);
            
            // 🔥 Show success message
            setUploadSuccess(true);
            setUploading(false);
            
            // 🔥 Clear recording after 2 seconds
            setTimeout(() => {
              setAudioURL(null);
              setAudioBlob(null);
              setUploadSuccess(false);
              setUploadProgress(0);
              
              // 🔥 Notify parent to refresh file list
              if (onUploadSuccess) {
                onUploadSuccess();
              }
            }, 2000);
            
          } else {
            throw new Error(data.message || 'Upload failed');
          }
        } else {
          throw new Error(`HTTP ${xhr.status}: Upload failed`);
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Network error during upload');
      });

      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);

    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const discardRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setAudioBlob(null);
    setUploadSuccess(false);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div style={styles.container}>
      {!audioURL ? (
        // Recording controls
        <div style={styles.recordingSection}>
          {!recording ? (
            <button 
              onClick={startRecording} 
              style={styles.recordButton}
              disabled={uploading}
            >
              🎤 Start Recording
            </button>
          ) : (
            <div style={styles.recordingActive}>
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot}>🔴</span>
                <span style={styles.recordingText}>Recording...</span>
              </div>
              <button 
                onClick={stopRecording} 
                style={styles.stopButton}
              >
                ⏹️ Stop Recording
              </button>
            </div>
          )}
        </div>
      ) : (
        // Preview and upload section
        <div style={styles.previewSection}>
          <div style={styles.audioPreview}>
            <div style={styles.previewLabel}>🎵 Recording Preview</div>
            <audio 
              src={audioURL} 
              controls 
              style={styles.audioPlayer}
            />
          </div>

          {uploadSuccess ? (
            // Success message
            <div style={styles.successMessage}>
              ✅ Upload Successful!
            </div>
          ) : uploading ? (
            // Uploading progress
            <div style={styles.uploadingSection}>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${uploadProgress}%`
                  }}
                />
              </div>
              <div style={styles.progressText}>
                Uploading... {uploadProgress}%
              </div>
            </div>
          ) : (
            // Upload and discard buttons
            <div style={styles.actions}>
              <button 
                onClick={uploadToCloud} 
                style={styles.uploadButton}
                disabled={uploading}
              >
                ☁️ Upload to Cloud
              </button>
              <button 
                onClick={discardRecording} 
                style={styles.discardButton}
                disabled={uploading}
              >
                🗑️ Discard
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  recordingSection: {
    textAlign: 'center',
    padding: '1rem',
  },
  recordButton: {
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'white',
    background: '#667eea',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  recordingActive: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: '#ffe0e0',
    borderRadius: '8px',
  },
  recordingDot: {
    fontSize: '1.2rem',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  recordingText: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#d32f2f',
  },
  stopButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: 'white',
    background: '#d32f2f',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  previewSection: {
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1rem',
    background: '#f8f9fa',
  },
  audioPreview: {
    marginBottom: '1rem',
  },
  previewLabel: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#666',
    marginBottom: '0.5rem',
  },
  audioPlayer: {
    width: '100%',
    marginBottom: '0.5rem',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
  },
  uploadButton: {
    flex: 1,
    padding: '0.75rem',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  discardButton: {
    flex: 1,
    padding: '0.75rem',
    background: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  uploadingSection: {
    width: '100%',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    background: '#667eea',
    transition: 'width 0.3s',
  },
  progressText: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#667eea',
    fontWeight: '600',
  },
  successMessage: {
    padding: '1rem',
    background: '#d4edda',
    color: '#155724',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  error: {
    marginTop: '1rem',
    padding: '0.75rem',
    background: '#ffe0e0',
    color: '#d32f2f',
    borderRadius: '8px',
    fontSize: '0.9rem',
  },
};