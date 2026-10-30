// Opt-in local diagnostics. Two animation frames approximate a painted response;
// timings include Vue updates and browser scheduling, not just JavaScript time.
export function enablePerformanceProbe() {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('perf')) return;
  const results: Record<string, number[]> = {};
  const report = document.createElement('output');
  report.id = 'performance-report';
  report.setAttribute('aria-label', '本机性能测量');
  report.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:100;background:#fff;padding:8px;font:12px monospace;max-width:340px;max-height:80px;overflow:auto';
  report.textContent = '性能测量已启用';
  document.body.append(report);
  let peakHeap = 0;
  function sample() {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    peakHeap = Math.max(peakHeap, memory?.usedJSHeapSize ?? 0);
    report.dataset.heapPeakBytes = String(peakHeap);
    report.dataset.domNodes = String(document.getElementsByTagName('*').length);
    report.dataset.measurements = JSON.stringify(results);
    report.dataset.status = document.querySelector('.status-next small')?.textContent ?? '';
    report.textContent = JSON.stringify(Object.fromEntries(Object.entries(results).map(([label, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [label, { n: values.length, p95: sorted[Math.floor((values.length - 1) * .95)] }];
    })));
  }
  function onClick(event: MouseEvent) {
    const button = (event.target as Element).closest('button');
    if (!button) return;
    const label = button.textContent?.trim() === '下一时段 →' ? '推进时段'
      : button.matches('.context-person') ? '打开人物'
      : button.getAttribute('aria-label') === '放大地图' ? '放大地图' : null;
    if (!label) return;
    const start = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      (results[label] ||= []).push(Math.round((performance.now() - start) * 10) / 10);
      if (results[label].length > 200) results[label].shift();
      sample();
    }));
  }
  document.addEventListener('click', onClick, true);
  const timer = setInterval(sample, 1000);
  import.meta.hot?.dispose(() => { clearInterval(timer); document.removeEventListener('click', onClick, true); report.remove(); });
}
