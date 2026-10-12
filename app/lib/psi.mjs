// Mesure de vitesse via l'API publique PageSpeed Insights (gratuite, sans clé, quota limité).
export async function measureSpeed(url, strategy = 'mobile') {
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`;
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(70000) });
    if (res.status === 429) return { error: 'quota gratuit atteint (réessayer plus tard)' };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const j = await res.json();
    const field = j.loadingExperience?.metrics || {};
    const lab = j.lighthouseResult?.audits || {};
    const out = { strategy, source: null, lcp_ms: null, cls: null, inp_ms: null };
    const f = (k) => field[k]?.percentile;
    if (f('LARGEST_CONTENTFUL_PAINT_MS') != null) { out.lcp_ms = f('LARGEST_CONTENTFUL_PAINT_MS'); out.source = 'données réelles utilisateurs, ' + strategy; }
    else if (lab['largest-contentful-paint']?.numericValue != null) { out.lcp_ms = Math.round(lab['largest-contentful-paint'].numericValue); out.source = 'test en laboratoire, ' + strategy; }
    if (f('CUMULATIVE_LAYOUT_SHIFT_SCORE') != null) out.cls = Math.round(f('CUMULATIVE_LAYOUT_SHIFT_SCORE')) / 100;
    else if (lab['cumulative-layout-shift']?.numericValue != null) out.cls = Math.round(lab['cumulative-layout-shift'].numericValue * 1000) / 1000;
    if (f('INTERACTION_TO_NEXT_PAINT') != null) out.inp_ms = f('INTERACTION_TO_NEXT_PAINT');
    out.score = j.lighthouseResult?.categories?.performance?.score != null ? Math.round(j.lighthouseResult.categories.performance.score * 100) : null;
    if (out.lcp_ms == null && out.cls == null) return { error: 'aucune donnée exploitable' };
    out.source = out.source || 'test en laboratoire, ' + strategy;
    return out;
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'délai dépassé' : e.message };
  }
}
