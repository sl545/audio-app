import React, { useEffect, useState, useRef } from 'react';
import Meyda from 'meyda';

/**
 * 统一的音频分析组件
 * 包含：MFCC、Spectrogram、Classifier
 * 共享同一个 AudioContext 和 source
 */
function AudioAnalysis({ audioRef }) {
  // 音频上下文（只创建一次）
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyzerRef = useRef(null);
  const meydaAnalyzerRef = useRef(null);
  
  // 状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mfccFeatures, setMfccFeatures] = useState(null);
  const [classification, setClassification] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  
  // Canvas refs
  const mfccCanvasRef = useRef(null);
  const spectrogramCanvasRef = useRef(null);
  
  // 动画和数据
  const animationRef = useRef(null);
  const samplesRef = useRef([]);

  // 初始化音频上下文（只调用一次）
  const initAudioContext = () => {
    if (audioContextRef.current) return; // 已经初始化

    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const source = context.createMediaElementSource(audioRef);
      const analyzer = context.createAnalyser();
      
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      
      // 连接：source → analyzer → destination
      source.connect(analyzer);
      analyzer.connect(context.destination);
      
      audioContextRef.current = context;
      sourceRef.current = source;
      analyzerRef.current = analyzer;
      
      console.log('✅ 音频上下文初始化成功');
    } catch (err) {
      console.error('❌ 音频上下文初始化失败:', err);
      setError(err.message);
    }
  };

  // 启动分析
  const startAnalysis = () => {
    try {
      // 初始化上下文（如果还没有）
      if (!audioContextRef.current) {
        initAudioContext();
      }

      const context = audioContextRef.current;
      const source = sourceRef.current;

      // 恢复 AudioContext（如果被暂停）
      if (context.state === 'suspended') {
        context.resume();
      }

      // 启动 Meyda 分析器（MFCC + Classifier）
      meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
        audioContext: context,
        source: source,
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
          
          // 收集样本用于分类
          samplesRef.current.push(features);
          if (samplesRef.current.length >= 20) {
            classifyAudio(samplesRef.current);
            samplesRef.current = samplesRef.current.slice(-10);
          }

          // 绘制 MFCC
          if (features.mfcc && mfccCanvasRef.current) {
            drawMFCC(features.mfcc);
          }
        },
      });

      meydaAnalyzerRef.current.start();
      
      // 启动 Spectrogram 绘制
      drawSpectrogram();
      
      setIsAnalyzing(true);
      setError(null);
      console.log('✅ 分析器启动成功');

    } catch (err) {
      console.error('❌ 分析器启动失败:', err);
      setError(err.message);
      setIsAnalyzing(false);
    }
  };

  // 停止分析
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

  // 绘制 MFCC
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

  // 绘制 Spectrogram
  const drawSpectrogram = () => {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas || !analyzerRef.current) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyzerRef.current.getByteFrequencyData(dataArray);

    // 向左移动
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    // 绘制新列（极度增强版本）
    for (let i = 0; i < height; i++) {
      const freqIndex = Math.floor((i / height) * bufferLength);
      const rawValue = dataArray[freqIndex];
      
      // 🔥 超强增强：放大 3 倍 + 基础亮度 50
      const enhanced = Math.min(255, rawValue * 3.0 + 50);
      const intensity = enhanced / 255;
      
      // 使用更鲜艳的颜色
      let r, g, b;
      
      if (intensity < 0.2) {
        // 深蓝到蓝
        r = 0;
        g = 0;
        b = Math.floor(100 + intensity * 5 * 155);
      } else if (intensity < 0.4) {
        // 蓝到青
        const t = (intensity - 0.2) * 5;
        r = 0;
        g = Math.floor(t * 255);
        b = 255;
      } else if (intensity < 0.6) {
        // 青到绿
        const t = (intensity - 0.4) * 5;
        r = 0;
        g = 255;
        b = Math.floor((1 - t) * 255);
      } else if (intensity < 0.8) {
        // 绿到黄
        const t = (intensity - 0.6) * 5;
        r = Math.floor(t * 255);
        g = 255;
        b = 0;
      } else {
        // 黄到红
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

  // 音频分类
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
      setClassification('音乐 (Music)');
      setConfidence(musicConfidence);
    } else {
      setClassification('语音 (Speech)');
      setConfidence(speechConfidence);
    }
  };

  // 事件监听
  useEffect(() => {
    if (!audioRef) return;

    audioRef.addEventListener('play', startAnalysis);
    audioRef.addEventListener('pause', stopAnalysis);
    audioRef.addEventListener('ended', stopAnalysis);

    return () => {
      audioRef.removeEventListener('play', startAnalysis);
      audioRef.removeEventListener('pause', stopAnalysis);
      audioRef.removeEventListener('ended', stopAnalysis);
      stopAnalysis();
    };
  }, [audioRef]);

  if (error) {
    return (
      <div style={styles.error}>
        <strong>分析器错误:</strong> {error}
      </div>
    );
  }

  if (!isAnalyzing && !mfccFeatures) return null;

  return (
    <div style={styles.container}>
      {/* Classifier Section */}
      <div style={styles.section}>
        <div style={styles.header}>
          <h3 style={styles.title}>🎯 音频分类器 (Audio Classifier)</h3>
          {isAnalyzing && <span style={styles.badge}>分析中...</span>}
        </div>

        {classification && (
          <div style={styles.classifierResult}>
            <div style={styles.classLabel}>
              分类结果: <strong>{classification}</strong>
            </div>
            <div style={styles.confidenceBar}>
              <div style={styles.confidenceLabel}>置信度: {confidence.toFixed(1)}%</div>
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
        <h4 style={styles.subtitle}>📊 Spectrogram（频谱图）</h4>
        <canvas
          ref={spectrogramCanvasRef}
          width={800}
          height={250}
          style={styles.canvas}
        />
        <div style={styles.labels}>
          <span>← 过去 | 时间 | 现在 →</span>
          <span>↑ 高频 | 频率 | ↓ 低频</span>
        </div>
      </div>

      {/* MFCC Section */}
      <div style={styles.section}>
        <h4 style={styles.subtitle}>🎵 MFCC 系数可视化</h4>
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
          <h4 style={styles.subtitle}>📈 实时音频特征</h4>
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>音量 (RMS)</div>
              <div style={styles.featureValue}>{mfccFeatures.rms?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>过零率 (ZCR)</div>
              <div style={styles.featureValue}>{mfccFeatures.zcr?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>频谱质心</div>
              <div style={styles.featureValue}>{mfccFeatures.spectralCentroid?.toFixed(2) || 'N/A'} Hz</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>频谱平坦度</div>
              <div style={styles.featureValue}>{mfccFeatures.spectralFlatness?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>能量</div>
              <div style={styles.featureValue}>{mfccFeatures.energy?.toFixed(4) || 'N/A'}</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureName}>MFCC 系数</div>
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
    animation: 'pulse 2s infinite',
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
    background: 'rgb(10, 10, 30)', // 深蓝色背景
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