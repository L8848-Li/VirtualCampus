import { Random } from './random.ts';
export type Weather = '晴' | '多云' | '小雨';
// A fictional daily weather sequence; no real-world forecast is implied.
export function weatherAt(seed: string, tick: number): Weather {
  const sample = new Random(`${seed}:weather:${Math.floor(Math.max(0, tick) / 4)}`).next();
  return sample < 0.22 ? '小雨' : sample < 0.56 ? '多云' : '晴';
}
