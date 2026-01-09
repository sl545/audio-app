import React, { useEffect, useState, useRef } from 'react';
import Meyda from 'meyda';

function FeatureExtractor({ audioRef }) {
  const [features, setFeatures] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const meydaAnalyzerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioRef) return;

    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createMediaElementSource(audioRef);
    const analyzer = context.createAnalyser();
    analyzer.fftSize = 2048;

    source.connect(analyzer);
    analyzer.connect(context.destination);

    // 音频播放时开始分析
    audioRef.onplay = () => {
      try {
        setIsAnalyzing(true);
        
        meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
          audioContext: context,
          source: source,
          bufferSize: 512,
          featureExtractors: [
            'mfcc',           // Mel-frequency cepstral coefficients
            'zcr',            // Zero Crossing Rate
            'spectralCentroid', // Spectral Centroid
            'spectralFlatness', // Spectral Flatness
            'rms',            // Root Mean Square (音量)
            'energy',         // Energy
          ],
          callback: extractedFeatures => {
            setFeatures(extractedFeatures);
            
            // 保存历史记录（最多保存 100 条）
            setAnalysisHistory(prev => {
              const newHistory = [...prev, {
                timestamp: Date.now(),
                features: extractedFeatures,
              }];
              return newHistory.slice(-100); // 只保留最近 100 条
            });

            // 绘制 MFCC 可视化
            if (extractedFeatures.mfcc && canvasRef.current) {
              drawMFCC(extractedFeatures.mfcc);
            }
          },
        });

        meydaAnalyzerRef.current.start();
      } catch (e) {
        console.error('Meyda 启动错误:', e);
        setIsAnalyzing(false);
      }
    };

    // 音频暂停/结束时停止分析
    const stopAnalysis = () => {
      if (meydaAnalyzerRef.current) {
        meydaAnalyzerRef.current.stop();
        setIsAnalyzing(false);
      }
    };

    audioRef.onpause = stopAnalysis;
    audioRef.onended = stopAnalysis;

    return () => {
      stopAnalysis();
      context.close();
    };
  }, [audioRef]);

  // 绘制 MFCC 可视化
  const drawMFCC = (mfccValues) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 绘制背景
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, width, height);

    // 绘制 MFCC 系数（柱状图）
    const barWidth = width / mfccValues.length;
    const maxValue = Math.max(...mfccValues.map(Math.abs));

    mfccValues.forEach((value, index) => {
      const normalizedValue = value / maxValue;
      const barHeight = (normalizedValue * height) / 2;
      const x = index * barWidth;
      const y = height / 2 - barHeight;

      // 颜色渐变（蓝色到红色）
      const hue = 240 - (index / mfccValues.length) * 240;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(x, y, barWidth - 2, Math.abs(barHeight));
    });

    // 绘制中心线
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  // 计算平均特征（从历史记录）
  const getAverageFeatures = () => {
    if (analysisHistory.length === 0) return null;

    const avgRMS = analysisHistory.reduce((sum, item) => sum + (item.features.rms || 0), 0) / analysisHistory.length;
    const avgZCR = analysisHistory.reduce((sum, item) => sum + (item.features.zcr || 0), 0) / analysisHistory.length;
    const avgSpectralCentroid = analysisHistory.reduce((sum, item) => sum + (item.features.spectralCentroid || 0), 0) / analysisHistory.length;

    return {
      avgRMS: avgRMS.toFixed(4),
      avgZCR: avgZCR.toFixed(4),
      avgSpectralCentroid: avgSpectralCentroid.toFixed(2),
    };
  };

  const averages = getAverageFeatures();

  if (!features && !isAnalyzing) return null;

  return (
    <div className="feature-extractor">
      <div className="feature-header">
        <h3>🎵 音频特征分析</h3>
        {isAnalyzing && <span className="analyzing-badge">实时分析中...</span>}
      </div>

      {/* MFCC 可视化 */}
      {features?.mfcc && (
        <div className="mfcc-visualization">
          <h4>MFCC 系数可视化</h4>
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={150}
            style={{ width: '100%', maxWidth: '600px', border: '1px solid #ddd' }}
          />
        </div>
      )}

      {/* 实时特征值 */}
      {features && (
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-label">音量 (RMS)</div>
            <div className="feature-value">{features.rms?.toFixed(4) || 'N/A'}</div>
          </div>

          <div className="feature-card">
            <div className="feature-label">过零率 (ZCR)</div>
            <div className="feature-value">{features.zcr?.toFixed(4) || 'N/A'}</div>
          </div>

          <div className="feature-card">
            <div className="feature-label">频谱质心</div>
            <div className="feature-value">{features.spectralCentroid?.toFixed(2) || 'N/A'} Hz</div>
          </div>

          <div className="feature-card">
            <div className="feature-label">频谱平坦度</div>
            <div className="feature-value">{features.spectralFlatness?.toFixed(4) || 'N/A'}</div>
          </div>

          <div className="feature-card">
            <div className="feature-label">能量</div>
            <div className="feature-value">{features.energy?.toFixed(4) || 'N/A'}</div>
          </div>

          <div className="feature-card">
            <div className="feature-label">MFCC 系数数量</div>
            <div className="feature-value">{features.mfcc?.length || 0}</div>
          </div>
        </div>
      )}

      {/* 平均值统计 */}
      {averages && (
        <div className="average-stats">
          <h4>📊 平均统计（基于 {analysisHistory.length} 个样本）</h4>
          <div className="stats-grid">
            <div>平均音量: {averages.avgRMS}</div>
            <div>平均过零率: {averages.avgZCR}</div>
            <div>平均频谱质心: {averages.avgSpectralCentroid} Hz</div>
          </div>
        </div>
      )}

      {/* MFCC 详细数据（可折叠） */}
      {features?.mfcc && (
        <details className="mfcc-details">
          <summary>🔍 查看完整 MFCC 数据 ({features.mfcc.length} 个系数)</summary>
          <pre className="mfcc-data">
            {JSON.stringify(features.mfcc.map(v => v.toFixed(4)), null, 2)}
          </pre>
        </details>
      )}

      {/* 样式 */}
      <style>{`
        .feature-extractor {
          margin-top: 2em;
          padding: 1.5em;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        .feature-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1em;
        }

        .feature-header h3 {
          margin: 0;
          color: #333;
        }

        .analyzing-badge {
          background: #28a745;
          color: white;
          padding: 0.25em 0.75em;
          border-radius: 12px;
          font-size: 0.85em;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .mfcc-visualization {
          margin-bottom: 1.5em;
        }

        .mfcc-visualization h4 {
          margin-bottom: 0.5em;
          color: #555;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1em;
          margin-bottom: 1.5em;
        }

        .feature-card {
          background: #f8f9fa;
          padding: 1em;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }

        .feature-label {
          font-size: 0.85em;
          color: #6c757d;
          margin-bottom: 0.5em;
        }

        .feature-value {
          font-size: 1.25em;
          font-weight: bold;
          color: #007bff;
        }

        .average-stats {
          background: #e7f3ff;
          padding: 1em;
          border-radius: 6px;
          margin-bottom: 1em;
        }

        .average-stats h4 {
          margin-top: 0;
          margin-bottom: 0.75em;
          color: #0056b3;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.5em;
          font-size: 0.95em;
        }

        .mfcc-details {
          margin-top: 1em;
        }

        .mfcc-details summary {
          cursor: pointer;
          padding: 0.5em;
          background: #f8f9fa;
          border-radius: 4px;
          user-select: none;
        }

        .mfcc-details summary:hover {
          background: #e9ecef;
        }

        .mfcc-data {
          background: #f4f4f4;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          margin-top: 0.5em;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}

export default FeatureExtractor;