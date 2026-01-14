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
      
      console.log('✅ 音频滤波器初始化成功');
      
      // 开始可视化
      if (isEnabled) {
        startVisualization();
      }
      
    } catch (err) {
      console.error('❌ 滤波器初始化失败:', err);
    }
  };

  // 更新滤波器参数
  useEffect(() => {
    if (!filterRef.current) return;
    
    filterRef.current.type = filterType;
    filterRef.current.frequency.value = frequency;
    filterRef.current.Q.value = q;
    filterRef.current.gain.value = gain;
    
    console.log('🎛️ 滤波器参数更新:', { filterType, frequency, q, gain });
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
    { value: 'lowpass', label: '🔉 低通滤波器', description: '保留低频，去除高频（让声音更柔和）' },
    { value: 'highpass', label: '🔊 高通滤波器', description: '保留高频，去除低频（去除隆隆声）' },
    { value: 'bandpass', label: '📻 带通滤波器', description: '只保留特定频率范围（电话效果）' },
    { value: 'notch', label: '🚫 陷波滤波器', description: '去除特定频率（消除嗡嗡声）' },
    { value: 'peaking', label: '📈 峰值滤波器', description: '增强或削弱特定频率' },
    { value: 'lowshelf', label: '📉 低频架型', description: '提升或削弱所有低频' },
    { value: 'highshelf', label: '📊 高频架型', description: '提升或削弱所有高频' },
  ];

  // 预设配置
  const presets = {
    'voice-enhance': { type: 'highpass', freq: 80, q: 0.7, label: '🎤 人声增强' },
    'bass-boost': { type: 'lowshelf', freq: 200, q: 1, gain: 10, label: '🔊 低音增强' },
    'treble-boost': { type: 'highshelf', freq: 4000, q: 1, gain: 10, label: '✨ 高音增强' },
    'telephone': { type: 'bandpass', freq: 1000, q: 2, label: '📞 电话效果' },
    'remove-hum': { type: 'notch', freq: 60, q: 10, label: '🔇 去除嗡嗡声' },
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
        <h3 style={styles.cardTitle}>🎛️ 音频滤波器</h3>
        <p style={styles.placeholder}>请先选择一个音频文件</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.cardTitle}>🎛️ 音频滤波器</h3>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.toggleLabel}>
            {isEnabled ? '✅ 已启用' : '⭕ 已禁用'}
          </span>
        </label>
      </div>

      {/* 预设按钮 */}
      <div style={styles.presets}>
        <div style={styles.presetLabel}>快速预设：</div>
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
        <label style={styles.label}>滤波器类型</label>
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
          截止频率: <strong>{frequency} Hz</strong>
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
          Q 值（锐度）: <strong>{q.toFixed(1)}</strong>
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
        <div style={styles.range}>0.1 (平缓) ←→ 20 (锐利)</div>
      </div>

      {/* 增益控制（仅部分滤波器需要）*/}
      {(filterType === 'peaking' || filterType === 'lowshelf' || filterType === 'highshelf') && (
        <div style={styles.control}>
          <label style={styles.label}>
            增益: <strong>{gain > 0 ? '+' : ''}{gain} dB</strong>
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
        <div style={styles.visualLabel}>频率响应（实时）</div>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          style={styles.canvas}
        />
        {!isEnabled && (
          <div style={styles.overlay}>
            启用滤波器以查看频率响应
          </div>
        )}
      </div>

      {/* 说明 */}
      <div style={styles.info}>
        <strong>💡 使用提示：</strong>
        <ul style={styles.tipsList}>
          <li><strong>低通滤波器：</strong>去除高频噪音，让声音更温暖柔和</li>
          <li><strong>高通滤波器：</strong>去除低频隆隆声，让人声更清晰</li>
          <li><strong>带通滤波器：</strong>只保留中间频率，模拟电话/收音机效果</li>
          <li><strong>陷波滤波器：</strong>精确去除特定频率的干扰（如 50/60Hz 电源噪音）</li>
          <li><strong>Q 值：</strong>数值越大，滤波器越锐利（影响范围越窄）</li>
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