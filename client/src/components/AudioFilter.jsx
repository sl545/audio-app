import React, { useEffect, useState, useRef } from 'react';

/**
 * 音频滤波器组件
 * 支持：高通、低通、带通、陷波滤波器
 */
function AudioFilter({ audioRef }) {
  // 音频上下文和节点
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const filterRef = useRef(null);
  const analyzerRef = useRef(null);
  const isInitializedRef = useRef(false);

  // 滤波器状态
  const [filterType, setFilterType] = useState('lowpass');
  const [frequency, setFrequency] = useState(1000);
  const [q, setQ] = useState(1);
  const [gain, setGain] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  
  // 可视化
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // 初始化音频上下文和滤波器
  const initAudioFilter = () => {
    if (!audioRef || isInitializedRef.current) return;

    try {
      // 创建音频上下文
      const context = new (window.AudioContext || window.webkitAudioContext)();
      
      // 创建音频源（从 audio 元素）
      const source = context.createMediaElementSource(audioRef);
      
      // 创建滤波器节点
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      filter.gain.value = gain;
      
      // 创建分析器（用于可视化）
      const analyzer = context.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      
      // 连接节点：source → filter → analyzer → destination
      source.connect(filter);
      filter.connect(analyzer);
      analyzer.connect(context.destination);
      
      // 保存引用
      audioContextRef.current = context;
      sourceRef.current = source;
      filterRef.current = filter;
      analyzerRef.current = analyzer;
      isInitializedRef.current = true;

      console.log('✅ Audio filter initialization successful');

      // 开始可视化
      if (isEnabled) {
        startVisualization();
      }
      
    } catch (err) {
      console.error('❌ Audio filter initialization failed:', err);
    }
  };

  // 更新滤波器参数
  useEffect(() => {
    if (!filterRef.current) return;
    
    filterRef.current.type = filterType;
    filterRef.current.frequency.value = frequency;
    filterRef.current.Q.value = q;
    filterRef.current.gain.value = gain;

    console.log('🎛️ Filter parameters updated:', { filterType, frequency, q, gain });
  }, [filterType, frequency, q, gain]);

  // 启用/禁用滤波器
  useEffect(() => {
    if (!audioRef || !isInitializedRef.current) return;
    
    if (isEnabled) {
      startVisualization();
    } else {
      stopVisualization();
    }
  }, [isEnabled]);

  // 当 audioRef 变化时，重新初始化
  useEffect(() => {
    if (audioRef && !isInitializedRef.current) {
      // 延迟初始化，等待 audio 元素加载
      const timer = setTimeout(() => {
        initAudioFilter();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [audioRef]);

  // 频率响应可视化
  const startVisualization = () => {
    if (!analyzerRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyzer = analyzerRef.current;
    
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyzer.getByteFrequencyData(dataArray);
      
      // 清空画布
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 绘制频率响应
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // 渐变色
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      
      // 绘制频率标记线
      drawFrequencyMarker(ctx, canvas);
    };
    
    draw();
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // 清空画布
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // 绘制频率标记线
  const drawFrequencyMarker = (ctx, canvas) => {
    if (!analyzerRef.current) return;
    
    const sampleRate = audioContextRef.current.sampleRate;
    const nyquist = sampleRate / 2;
    
    // 计算当前滤波器频率在画布上的位置
    const x = (frequency / nyquist) * canvas.width;
    
    // 绘制垂直线
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制频率标签
    ctx.fillStyle = '#ff4444';
    ctx.font = '12px monospace';
    ctx.fillText(`${frequency} Hz`, x + 5, 15);
  };

  // 滤波器类型配置
  const filterTypes = [
    { value: 'lowpass', label: '🔉  Lowpass filter', description: 'keep low frequencies, remove high frequencies, make sound softer' },
    { value: 'highpass', label: '🔊 Highpass filter', description: 'keep high frequencies, remove low frequencies, eliminate rumble' },
    { value: 'bandpass', label: '📻 Bandpass filter', description: 'keep only a specific frequency range, create a telephone effect' },
    { value: 'notch', label: '🚫 Notch filter', description: 'remove a specific frequency, eliminate hum' },
    { value: 'peaking', label: '📈 Peaking filter', description: 'boost or cut a specific frequency' },
    { value: 'lowshelf', label: '📉 Lowshelf filter', description: 'boost or cut all low frequencies' },
    { value: 'highshelf', label: '📊 Highshelf filter', description: 'boost or cut all high frequencies' },
  ];

  // 预设配置
  const presets = {
    'voice-enhance': { type: 'highpass', freq: 80, q: 0.7, label: '🎤 Voice Enhance' },
    'bass-boost': { type: 'lowshelf', freq: 200, q: 1, gain: 10, label: '🔊 Bass Boost' },
    'treble-boost': { type: 'highshelf', freq: 4000, q: 1, gain: 10, label: '✨ Treble Boost' },
    'telephone': { type: 'bandpass', freq: 1000, q: 2, label: '📞 Telephone Effect' },
    'remove-hum': { type: 'notch', freq: 60, q: 10, label: '🔇 Remove Hum' },
  };

  const applyPreset = (preset) => {
    setFilterType(preset.type);
    setFrequency(preset.freq);
    setQ(preset.q);
    if (preset.gain !== undefined) setGain(preset.gain);
    setIsEnabled(true);
  };

  // 清理
  useEffect(() => {
    return () => {
      stopVisualization();
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  if (!audioRef) {
    return (
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🎛️ Audio Filter</h3>
        <p style={styles.placeholder}>Please choose an audio file</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.cardTitle}>🎛️ Audio Filter</h3>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.toggleLabel}>
            {isEnabled ? '✅ Enabled' : '⭕ Disabled'}
          </span>
        </label>
      </div>

      {/* 预设按钮 */}
      <div style={styles.presets}>
        <div style={styles.presetLabel}>Speed Presets</div>
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(preset)}
            style={styles.presetButton}
            title={preset.label}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* 滤波器类型选择 */}
      <div style={styles.control}>
        <label style={styles.label}>Filter Type</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={styles.select}
          disabled={!isEnabled}
        >
          {filterTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <div style={styles.description}>
          {filterTypes.find(t => t.value === filterType)?.description}
        </div>
      </div>

      {/* 频率控制 */}
      <div style={styles.control}>
        <label style={styles.label}>
          Cutoff frequency: <strong>{frequency} Hz</strong>
        </label>
        <input
          type="range"
          min="20"
          max="20000"
          value={frequency}
          onChange={(e) => setFrequency(Number(e.target.value))}
          style={styles.slider}
          disabled={!isEnabled}
        />
        <div style={styles.range}>20 Hz ←→ 20,000 Hz</div>
      </div>

      {/* Q 值控制（品质因数）*/}
      <div style={styles.control}>
        <label style={styles.label}>
          Q-Value (Sharpness): <strong>{q.toFixed(1)}</strong>
        </label>
        <input
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          style={styles.slider}
          disabled={!isEnabled}
        />
        <div style={styles.range}>0.1 (flat) ←→ 20 (sharp)</div>
      </div>

      {/* 增益控制（仅部分滤波器需要）*/}
      {(filterType === 'peaking' || filterType === 'lowshelf' || filterType === 'highshelf') && (
        <div style={styles.control}>
          <label style={styles.label}>
            Gain: <strong>{gain > 0 ? '+' : ''}{gain} dB</strong>
          </label>
          <input
            type="range"
            min="-40"
            max="40"
            value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
            style={styles.slider}
            disabled={!isEnabled}
          />
          <div style={styles.range}>-40 dB ←→ +40 dB</div>
        </div>
      )}

      {/* 频率响应可视化 */}
      <div style={styles.visualContainer}>
        <div style={styles.visualLabel}>frequency response (real-time)</div>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          style={styles.canvas}
        />
        {!isEnabled && (
          <div style={styles.overlay}>
            Enable the filter to view the frequency response
          </div>
        )}
      </div>

      {/* 说明 */}
      <div style={styles.info}>
        <strong>💡 Usage prompt</strong>
        <ul style={styles.tipsList}>
          <li><strong>Low-pass filter</strong>:remove high-frequency noise for a warmer sound</li>
          <li><strong>High-pass filter</strong>:remove low-frequency rumble for clearer vocals</li>
          <li><strong>Band-pass filter</strong>:simulate phone/radio effect by keeping mid frequencies</li>
          <li><strong>Notch filter</strong>:remove specific frequency interference (e.g., 50/60Hz power noise)</li>
          <li><strong>Q value</strong>:higher values mean a sharper filter (narrower range)</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.25rem',
    color: '#333',
    fontWeight: '600',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#667eea',
  },
  presets: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  presetLabel: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '600',
  },
  presetButton: {
    padding: '0.5rem 1rem',
    background: '#f0f0f0',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  control: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.95rem',
    color: '#333',
    fontWeight: '500',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'white',
  },
  description: {
    marginTop: '0.5rem',
    fontSize: '0.85rem',
    color: '#666',
    fontStyle: 'italic',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    outline: 'none',
    cursor: 'pointer',
  },
  range: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: '#999',
  },
  visualContainer: {
    position: 'relative',
    marginTop: '1.5rem',
    marginBottom: '1.5rem',
  },
  visualLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '0.5rem',
    fontWeight: '600',
  },
  canvas: {
    width: '100%',
    height: '200px',
    borderRadius: '8px',
    background: '#1a1a2e',
  },
  overlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  info: {
    background: '#f8f9fa',
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    color: '#555',
    lineHeight: '1.6',
  },
  tipsList: {
    margin: '0.5rem 0 0 0',
    paddingLeft: '1.5rem',
  },
  placeholder: {
    textAlign: 'center',
    color: '#999',
    padding: '2rem',
  },
};

export default AudioFilter;