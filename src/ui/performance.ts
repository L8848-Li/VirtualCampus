// Opt-in local diagnostics. Two animation frames approximate a painted response;
// timings include Vue updates and browser scheduling, not just JavaScript time.
export function enablePerformanceProbe() {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('perf')) return;
  const results: Record<string, number[]> = {};
  const report = document.createElement('output');
  report.id = 'performance-report';
  report.setAttribute('aria-label', '本机性能测量');
  report.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:100;background:#fff;padding:8px;font:12px monospace';
  report.textContent = '性能测量已启用';
  document.body.append(report);
  document.addEventListener('click', (event) => {
    const button = (event.target as Element).closest('button');
    if (!button) return;
    const label = button.textContent?.trim() === '下一时段 →' ? '推进时段'
      : button.matches('.context-person') ? '打开人物'
      : button.getAttribute('aria-label') === '放大地图' ? '放大地图' : null;
    if (!label) return;
    const start = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      (results[label] ||= []).push(Math.round((performance.now() - start) * 10) / 10);
      report.textContent = JSON.stringify(results);
    }));
  }, true);
}
