import React, { useEffect, useState, useRef } from 'react';
import Meyda from 'meyda';
import { useAudioContext } from './AudioContextProvider';

/**
 * Audio Analysis Component (Shared Context Version)
 * Uses shared AudioContext to prevent conflicts
 */
function AudioAnalysis({ audioRef }) {
  const { audioContext, sourceNode, isInitialized } = useAudioContext();
  
  const analyzerRef = useRef(null);
  const meydaAnalyzerRef = useRef(null);
  
  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mfccFeatures, setMfccFeatures] = useState(null);
  const [classification, setClassification] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  
  // Canvas refs
  const mfccCanvasRef = useRef(null);
  const spectrogramCanvasRef = useRef(null);
  
  // Animation and data
  const animationRef = useRef(null);
  const samplesRef = useRef([]);
  const destinationRef = useRef(null);

  // Create analyzer node
  const createAnalyzer = () => {
    if (!audioContext || !sourceNode || analyzerRef.current) return;

    try {
      console.log('📊 Creating analyzer for AudioAnalysis...');

      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;

      // Create destination to prevent disconnection
      const destination = audioContext.createGain();
      destination.gain.value = 1;

      // Connect: sourceNode → analyzer → destination
      sourceNode.connect(analyzer);
      analyzer.connect(destination);
      destination.connect(audioContext.destination);

      analyzerRef.current = analyzer;
      destinationRef.current = destination;

      console.log('✅ AudioAnalysis analyzer created');

    } catch (err) {
      console.error('❌ Failed to create analyzer:', err);
      setError(err.message);
    }
  };

  // Start analysis
  const startAnalysis = () => {
    if (!audioContext || !sourceNode) {
      console.log('⏳ Waiting for shared context...');
      return;
    }

    if (!analyzerRef.current) {
      createAnalyzer();
    }

    if (!analyzerRef.current) return;

    try {
      // Resume AudioContext if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('▶️ AudioContext resumed');
        });
      }

      // Start Meyda analyzer
      meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
        audioContext: audioContext,
        source: sourceNode,
        bufferSize: 512,
        featureExtractors: [
          'mfcc',
          'spectralCentroid',
          'spectralFlatness',
          'zcr',
          'rms',
          'energy',
        ],
        callback: (features) => {
          setMfccFeatures(features);
          
          // Collect samples for classification
          samplesRef.current.push(features);
          if (samplesRef.current.length >= 20) {
            classifyAudio(samplesRef.current);
            samplesRef.current = samplesRef.current.slice(-10);
          }

          // Draw MFCC
          if (features.mfcc && mfccCanvasRef.current) {
            drawMFCC(features.mfcc);
          }
        },
      });

      meydaAnalyzerRef.current.start();
      
      // Start Spectrogram
      drawSpectrogram();
      
      setIsAnalyzing(true);
      setError(null);
      console.log('✅ AudioAnalysis started');

    } catch (err) {
      console.error('❌ Analysis startup failed:', err);
      setError(err.message);
      setIsAnalyzing(false);
    }
  };

  // Stop analysis
  const stopAnalysis = () => {
    if (meydaAnalyzerRef.current) {
      meydaAnalyzerRef.current.stop();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsAnalyzing(false);
    samplesRef.current = [];
  };

  // Draw MFCC
  const drawMFCC = (mfccValues) => {
    const canvas = mfccCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / mfccValues.length;
    const maxValue = Math.max(...mfccValues.map(Math.abs));

    mfccValues.forEach((value, index) => {
      const normalizedValue = value / maxValue;
      const barHeight = (normalizedValue * height) / 2;
      const x = index * barWidth;
      const y = height / 2 - barHeight;

      const hue = 240 - (index / mfccValues.length) * 240;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y, barWidth - 2, Math.abs(barHeight));
    });

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  // Draw Spectrogram
  const drawSpectrogram = () => {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas || !analyzerRef.current) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyzerRef.current.getByteFrequencyData(dataArray);

    // Shift left
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    // Draw new column
    for (let i = 0; i < height; i++) {
      const freqIndex = Math.floor((i / height) * bufferLength);
      const rawValue = dataArray[freqIndex];
      
      const enhanced = Math.min(255, rawValue * 3.0 + 50);
      const intensity = enhanced / 255;
      
      let r, g, b;
      
      if (intensity < 0.2) {
        r = 0;
        g = 0;
        b = Math.floor(100 + intensity * 5 * 155);
      } else if (intensity < 0.4) {
        const t = (intensity - 0.2) * 5;
        r = 0;
        g = Math.floor(t * 255);
        b = 255;
      } else if (intensity < 0.6) {
        const t = (intensity - 0.4) * 5;
        r = 0;
        g = 255;
        b = Math.floor((1 - t) * 255);
      } else if (intensity < 0.8) {
        const t = (intensity - 0.6) * 5;
        r = Math.floor(t * 255);
        g = 255;
        b = 0;
      } else {
        const t = (intensity - 0.8) * 5;
        r = 255;
        g = Math.floor((1 - t) * 255);
        b = 0;
      }
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(width - 1, height - i - 1, 1, 1);
    }

    if (isAnalyzing) {
      animationRef.current = requestAnimationFrame(drawSpectrogram);
    }
  };

  // Audio classification
  const classifyAudio = (samples) => {
    if (samples.length === 0) return;

    const avgSpectralCentroid = samples.reduce((sum, s) => sum + (s.spectralCentroid || 0), 0) / samples.length;
    const avgSpectralFlatness = samples.reduce((sum, s) => sum + (s.spectralFlatness || 0), 0) / samples.length;
    const avgZCR = samples.reduce((sum, s) => sum + (s.zcr || 0), 0) / samples.length;

    let musicScore = 0;
    let speechScore = 0;

    if (avgSpectralCentroid > 2000) musicScore += 2; else speechScore += 2;
    if (avgSpectralFlatness > 0.3) speechScore += 2; else musicScore += 2;
    if (avgZCR > 0.1) speechScore += 1; else musicScore += 1;

    const totalScore = musicScore + speechScore;
    const musicConfidence = (musicScore / totalScore) * 100;
    const speechConfidence = (speechScore / totalScore) * 100;

    if (musicScore > speechScore) {
      setClassification('Music');
      setConfidence(musicConfidence);
    } else {
      setClassification('Speech');
      setConfidence(speechConfidence);
    }
  };

  // Wait for shared context to be ready
  useEffect(() => {
    if (isInitialized && audioContext && sourceNode) {
      createAnalyzer();
    }
  }, [isInitialized, audioContext, sourceNode]);

  // Event listeners
  useEffect(() => {
    if (!audioRef) return;

    const handlePlay = () => {
      console.log('▶️ Audio playing (AudioAnalysis)');
      startAnalysis();
    };

    const handlePause = () => {
      console.log('⏸️ Audio paused (AudioAnalysis)');
      stopAnalysis();
    };

    const handleEnded = () => {
      console.log('⏹️ Audio ended (AudioAnalysis)');
      stopAnalysis();
    };

    audioRef.addEventListener('play', handlePlay);
    audioRef.addEventListener('pause', handlePause);
    audioRef.addEventListener('ended', handleEnded);

    return () => {
      audioRef.removeEventListener('play', handlePlay);
      audioRef.removeEventListener('pause', handlePause);
      audioRef.removeEventListener('ended', handleEnded);
      stopAnalysis();
    };
  }, [audioRef, isInitialized]);

  if (error) {
    return (
      <div style={styles.error}>
        <strong>Analyzer Error:</strong> {error}
      </div>
    );
  }

  if (!isAnalyzing && !mfccFeatures) return null;

  return (
    <div style={styles.container}>
      {/* Classifier Section */}
      <div style={styles.section}>
        <div style={styles.header}>
          <h3 style={styles.title}>🎯 Audio Classifier</h3>
          {isAnalyzing && <span style={styles.badge}>Analyzing...</span>}
        </div>

        {classification && (
          <div style={styles.classifierResult}>
            <div style={styles.classLabel}>
              Classification Result: <strong>{classification}</strong>
            </div>
            <div style={styles.confidenceBar}>
              <div style={styles.confidenceLabel}>Confidence: {confidence.toFixed(1)}%</div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progress,
                    width: `${confidence}%`,
                    background: confidence > 70 ? '#28a745' : confidence > 50 ? '#ffc107' : '#dc3545',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spectrogram Section */}
      <div style={styles.section}>
        <h4 style={styles.subtitle}>📊 Spectrogram</h4>
        <canvas
          ref={spectrogramCanvasRef}
          width={800}
          height={250}
          style={styles.canvas}
        />
        <div style={styles.labels}>
          <span>← Past | Time | Present →</span>
          <span>↑ High Freq | Frequency | Low Freq ↓</span>
        </div>
      </div>

      {/* MFCC Section */}
      <div style={styles.section}>
        <h4 style={styles.subtitle}>🎵 MFCC Coefficients Visualization</h4>
        <canvas
          ref={mfccCanvasRef}
          width={600}
          height={150}
          style={styles.canvas}
        />
      </div>

      {/* Features Display */}
      {mfccFeatures && (
        <div style={styles.section}>
          <h4 style={styles.subtitle}>📈 Real-time Audio Features</h4>
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>Volume (RMS)</div>
              <div style={styles.featureValue}>{mfccFeatures.rms?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>Zero Crossing Rate</div>
              <div style={styles.featureValue}>{mfccFeatures.zcr?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>Spectral Centroid</div>
              <div style={styles.featureValue}>{mfccFeatures.spectralCentroid?.toFixed(2) || 'N/A'} Hz</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>Spectral Flatness</div>
              <div style={styles.featureValue}>{mfccFeatures.spectralFlatness?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>Energy</div>
              <div style={styles.featureValue}>{mfccFeatures.energy?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>MFCC Coefficients</div>
              <div style={styles.featureValue}>{mfccFeatures.mfcc?.length || 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  section: {
    padding: '1.5rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #ddd',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    color: '#333',
  },
  subtitle: {
    margin: '0 0 1rem 0',
    fontSize: '1.1rem',
    color: '#555',
  },
  badge: {
    background: '#28a745',
    color: 'white',
    padding: '0.375rem 0.875rem',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  classifierResult: {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
  },
  classLabel: {
    fontSize: '1.25rem',
    marginBottom: '1rem',
    color: '#333',
  },
  confidenceBar: {
    marginTop: '1rem',
  },
  confidenceLabel: {
    fontSize: '0.95rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  progressBar: {
    width: '100%',
    height: '24px',
    background: '#e9ecef',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  canvas: {
    width: '100%',
    height: 'auto',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: 'rgb(10, 10, 30)',
  },
  labels: {
    marginTop: '0.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
    color: '#666',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  featureCard: {
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  featureName: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  featureValue: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#007bff',
  },
  error: {
    padding: '1rem',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
  },
};

export default AudioAnalysis;