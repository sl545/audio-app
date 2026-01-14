import React from 'react';

/**
 * 简化的 Waveform 组件
 * 因为音频是通过后端代理的，URL 不包含文件扩展名
 * 所以我们直接显示一个简单的音频可视化
 */
function Waveform({ audioUrl }) {
  return (
    <div style={styles.container}>
      <div style={styles.placeholder}>
        <div style={styles.icon}>📊</div>
        <p style={styles.text}>音频波形显示</p>
        <p style={styles.subtext}>
          当前使用代理 URL，波形可视化暂时不可用
        </p>
        <div style={styles.visualBars}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.bar,
                height: `${Math.random() * 80 + 20}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '8px',
  },
  placeholder: {
    textAlign: 'center',
    padding: '2rem 1rem',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  text: {
    margin: '0.5rem 0',
    color: '#666',
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  subtext: {
    margin: '0.5rem 0 2rem 0',
    color: '#999',
    fontSize: '0.9rem',
  },
  visualBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '4px',
    height: '100px',
    padding: '0 2rem',
  },
  bar: {
    width: '8px',
    background: 'linear-gradient(to top, #667eea, #764ba2)',
    borderRadius: '4px 4px 0 0',
    animation: 'wave 2s ease-in-out infinite',
  },
};

// 添加动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes wave {
    0%, 100% {
      transform: scaleY(1);
      opacity: 0.6;
    }
    50% {
      transform: scaleY(0.5);
      opacity: 1;
    }
  }
`;
document.head.appendChild(styleSheet);

export default Waveform;