// server/services/classification.service.js
// 简单音频分类服务（基于规则）

const Meyda = require('meyda');

class ClassificationService {
  /**
   * 分析音频并返回分类结果
   * @param {Float32Array} audioBuffer - 音频数据
   * @param {number} sampleRate - 采样率
   * @returns {Object} 分类结果
   */
  static classify(audioBuffer, sampleRate = 44100) {
    try {
      // 1. 提取音频特征
      const features = this.extractFeatures(audioBuffer, sampleRate);
      
      // 2. 基于规则分类
      const classification = this.ruleBasedClassification(features);
      
      // 3. 返回结果
      return {
        type: classification.type,
        confidence: classification.confidence,
        features: {
          spectralCentroid: features.spectralCentroid.toFixed(2),
          rms: features.rms.toFixed(4),
          zcr: features.zcr.toFixed(4),
          mfccMean: features.mfcc.slice(0, 5).map(v => v.toFixed(2))
        },
        description: this.getDescription(classification.type)
      };
    } catch (error) {
      console.error('❌ 分类失败:', error);
      throw error;
    }
  }

  /**
   * 提取音频特征
   */
  static extractFeatures(audioBuffer, sampleRate) {
    const bufferSize = 512;
    const hopSize = 256;
    
    let mfccSum = new Array(13).fill(0);
    let spectralCentroidSum = 0;
    let rmsSum = 0;
    let zcrSum = 0;
    let count = 0;

    // 分帧分析
    for (let i = 0; i < audioBuffer.length - bufferSize; i += hopSize) {
      const frame = audioBuffer.slice(i, i + bufferSize);
      
      const features = Meyda.extract([
        'mfcc',
        'spectralCentroid',
        'rms',
        'zcr'
      ], frame);

      if (features.mfcc) {
        features.mfcc.forEach((val, idx) => {
          mfccSum[idx] += val;
        });
      }
      
      spectralCentroidSum += features.spectralCentroid || 0;
      rmsSum += features.rms || 0;
      zcrSum += features.zcr || 0;
      count++;
    }

    // 计算平均值
    return {
      mfcc: mfccSum.map(val => val / count),
      spectralCentroid: spectralCentroidSum / count,
      rms: rmsSum / count,
      zcr: zcrSum / count,
      duration: audioBuffer.length / sampleRate
    };
  }

  /**
   * 基于规则的分类
   */
  static ruleBasedClassification(features) {
    const { spectralCentroid, rms, zcr, mfcc } = features;

    // 计算 MFCC 的标准差（衡量音频变化程度）
    const mfccStd = this.calculateStd(mfcc);

    // 分类规则（按优先级）
    const rules = [
      {
        name: 'silence',
        check: () => rms < 0.01,
        confidence: 0.9,
        priority: 1
      },
      {
        name: 'speech',
        check: () => {
          // 语音特征：
          // - 中等频率中心（1000-3000 Hz）
          // - 较高的过零率
          // - MFCC 变化较大
          return (
            spectralCentroid > 1000 && 
            spectralCentroid < 3000 &&
            zcr > 0.1 &&
            mfccStd > 5
          );
        },
        confidence: 0.8,
        priority: 2
      },
      {
        name: 'music',
        check: () => {
          // 音乐特征：
          // - 较宽的频率范围
          // - 高能量
          // - MFCC 变化适中
          return (
            spectralCentroid > 2000 &&
            rms > 0.1 &&
            mfccStd > 3 && 
            mfccStd < 8
          );
        },
        confidence: 0.75,
        priority: 3
      },
      {
        name: 'noise',
        check: () => {
          // 噪音特征：
          // - MFCC 变化小
          // - 或低能量且低频
          return (
            mfccStd < 3 ||
            (rms < 0.05 && spectralCentroid < 1000)
          );
        },
        confidence: 0.7,
        priority: 4
      }
    ];

    // 按优先级应用规则
    rules.sort((a, b) => a.priority - b.priority);
    
    for (const rule of rules) {
      if (rule.check()) {
        return {
          type: rule.name,
          confidence: rule.confidence
        };
      }
    }

    // 默认分类
    return {
      type: 'unknown',
      confidence: 0.5
    };
  }

  /**
   * 计算标准差
   */
  static calculateStd(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * 获取分类描述
   */
  static getDescription(type) {
    const descriptions = {
      speech: 'Human speech or voice content',
      music: 'Musical content with instruments or melody',
      noise: 'Background noise or non-musical sound',
      silence: 'Silent or very quiet audio',
      unknown: 'Unable to classify accurately'
    };
    return descriptions[type] || 'Unknown type';
  }

  /**
   * 获取分类图标（用于前端显示）
   */
  static getIcon(type) {
    const icons = {
      speech: '🗣️',
      music: '🎵',
      noise: '📢',
      silence: '🔇',
      unknown: '❓'
    };
    return icons[type] || '📁';
  }
}

module.exports = ClassificationService;