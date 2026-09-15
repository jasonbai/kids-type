import { describe, expect, it } from 'vitest';
import { findPeakOffsets, panForCode } from './sound';

describe('panForCode（物理键位 → 立体声偏移）', () => {
  it('左手键偏左，右手键偏右，中列外键居中', () => {
    expect(panForCode('KeyQ')).toBe(-0.3);
    expect(panForCode('KeyA')).toBe(-0.3);
    expect(panForCode('KeyP')).toBe(0.3);
    expect(panForCode('KeyL')).toBe(0.3);
    expect(panForCode('Space')).toBe(0); // 双手拇指
    expect(panForCode('UnknownCode')).toBe(0);
  });
});

describe('findPeakOffsets（击键起振点扫描）', () => {
  const SR = 1000; // 1kHz 便于按毫秒推理

  it('识别超过阈值的峰，且相邻峰间距不小于 100ms', () => {
    const data = new Float32Array(1000);
    data[100] = 0.5; // t=100ms
    data[150] = 0.6; // t=150ms：与上一峰差 50ms < 100ms，应被忽略
    data[300] = 0.4; // t=300ms：合法
    data[500] = 0.1; // 低于阈值 0.3，忽略
    const offsets = findPeakOffsets(data, SR);
    expect(offsets).toEqual([0.098, 0.298]); // 各回退 2ms pre-roll
  });

  it('负振幅同样算峰；静音输入返回空', () => {
    const data = new Float32Array(500);
    data[200] = -0.9;
    expect(findPeakOffsets(data, SR)).toEqual([0.198]);
    expect(findPeakOffsets(new Float32Array(500), SR)).toEqual([]);
  });
});
