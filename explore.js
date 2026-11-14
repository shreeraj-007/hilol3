/* Trend Explorer: guided selection + chart + verdict, driven by data/results.json and data/content.json. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtMonth = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

  const state = { cat: null, variable: null, series: null, view: 'anomaly' };
  let DATA, CONTENT, BY_ID;

  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.2 7 10.6l4.6-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_DASH = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 8h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  TD.load().then(({ results, content }) => {
    DATA = results; CONTENT = content;
    BY_ID = Object.fromEntries(results.map(r => [r.id, r]));
    const fromUrl = new URLSearchParams(location.search).get('series');
    const initial = BY_ID[fromUrl] ? fromUrl : 'NearSurfaceAirTemperature_Furnace';
    select(initial, false);
  }).catch(err => {
    $('#app').innerHTML = `<div class="error" role="alert">Could not load the data files (${esc(err.message)}). If you opened this page straight from your computer, run a local web server instead. See README_WEBSITE.md.</div>`;
  });

  function varsInCat(cat) {
    return Object.keys(CONTENT.variables).filter(v => CONTENT.variables[v].category === cat && DATA.some(r => r.variable === v));
  }
  function seriesForVar(v) { return DATA.filter(r => r.variable === v); }
  function placeOf(id) { return CONTENT.locations[id]?.place || BY_ID[id].location; }

  function select(seriesId, push = true) {
    const r = BY_ID[seriesId];
    state.series = seriesId;
    state.variable = r.variable;
    state.cat = CONTENT.variables[r.variable].category;
    if (push) history.replaceState(null, '', `?series=${encodeURIComponent(seriesId)}`);
    renderChips();
    renderResult();
  }

  function chip(label, pressed, onClick, extra = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.innerHTML = esc(label) + (extra ? ` <small>${esc(extra)}</small>` : '');
    b.addEventListener('click', onClick);
    return b;
  }

  function renderChips() {
    const cats = $('#cat-chips'); cats.innerHTML = '';
    CONTENT.categories.forEach(c => cats.appendChild(chip(c.label, c.id === state.cat, () => {
      const v = varsInCat(c.id)[0];
      select(seriesForVar(v)[0].id);
    }, '')));
    const cq = CONTENT.categories.find(c => c.id === state.cat);
    cats.title = cq ? cq.question : '';

    const vars = $('#var-chips'); vars.innerHTML = '';
    varsInCat(state.cat).forEach(v => vars.appendChild(chip(CONTENT.variables[v].short, v === state.variable, () => select(seriesForVar(v)[0].id))));

    const locs = $('#loc-chips'); locs.innerHTML = '';
    seriesForVar(state.variable).forEach(r => locs.appendChild(chip(placeOf(r.id), r.id === state.series, () => select(r.id), CONTENT.locations[r.id]?.region || '')));
  }

  function plainSummary(r, v) {
    const years = (r.series.date.length > 1)
      ? ((new Date(r.end + '-01') - new Date(r.start + '-01')) / (365.25 * 864e5)) : 0;
    const total = r.slope_per_year * years;
    const ciIncludesZero = r.ci95_per_year[0] <= 0 && r.ci95_per_year[1] >= 0;
    const dir = TD.direction(r);
    let s = `<p>From ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, once the seasonal cycle is removed, the best-fit line for <strong>${esc(v.short.toLowerCase())}</strong> at <strong>${esc(placeOf(r.id))}</strong> changes by <strong>${TD.fmtRate(r.slope_per_year, esc(v.unit))}</strong>. Over the ${years.toFixed(0)}-year record that adds up to about <strong>${TD.fmtNum(total, 2, true)} ${esc(v.unit)}</strong>.</p>`;
    if (r.significant) {
      s += `<p>The p-value is ${TD.fmtP(r.p_value)}, below 0.05, so this <strong>${esc(dir)} trend is statistically significant</strong>: random month-to-month noise alone would be unlikely to produce a slope this steep. The 95% confidence interval (${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)} ${esc(v.unit)}/year) ${ciIncludesZero ? 'still touches zero, so treat the direction with caution' : 'does not include zero, so the direction of change is clear'}.</p>`;
    } else {
      s += `<p>The p-value is ${TD.fmtP(r.p_value)}, above 0.05, so the trend is <strong>not statistically significant</strong>. The line leans slightly ${r.slope_per_year > 0 ? 'upward' : 'downward'}, but a slope this size could easily come from natural variability. The 95% confidence interval (${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)} ${esc(v.unit)}/year) includes zero. This does not prove nothing is changing; a longer record might reveal a trend.</p>`;
    }
    if (r.n_missing_fill / r.n_rows_in_file > 0.05) {
      const mbm = r.missing_by_calendar_month || {};
      const often = Object.keys(mbm).filter(m => mbm[m] >= 5).map(m => MONTHS[m - 1]);
      s += `<p><strong>Caution:</strong> ${r.n_missing_fill} of the ${r.n_rows_in_file} months in this record were missing${often.length ? `, mostly in ${often.join(', ')}` : ''}. When the same part of the year is missing again and again, the record mainly reflects the other seasons, and gaps of one or two months were filled in by interpolation. Treat this result as weaker evidence than the others.</p>`;
    }
    s += `<p class="muted" style="font-size:.9rem">The straight line explains ${(r.r_squared * 100).toFixed(1)}% of the month-to-month variation (R² = ${r.r_squared.toFixed(3)}). Most of the wiggle is natural variability around the trend.</p>`;
    return s;
  }

  function renderResult() {
    const r = BY_ID[state.series];
    const v = CONTENT.variables[r.variable];
    const loc = CONTENT.locations[r.id] || {};
    const notes = CONTENT.notes[r.id];
    const missingNote = r.n_missing_fill > 0
      ? `${r.n_missing_fill} of ${r.n_rows_in_file} months in the source file were flagged as missing (−9999); ${r.n_months} months were used after filling short gaps.`
      : `All ${r.n_months} months in the source file had valid values.`;

    const badge = r.significant
      ? `<span class="badge sig">${ICON_CHECK} Significant trend</span>`
      : `<span class="badge notsig">${ICON_DASH} No significant trend</span>`;

    const compareRows = seriesForVar(r.variable).map(o => `
      <tr class="${o.id === r.id ? 'current' : ''}">
        <td>${o.id === r.id ? `<strong>${esc(placeOf(o.id))}</strong>` : `<button type="button" data-go="${esc(o.id)}">${esc(placeOf(o.id))}</button>`}</td>
        <td>${TD.fmtNum(o.slope_per_year, 3, true)}</td>
        <td>${o.significant ? '<strong>Yes</strong>, ' + esc(TD.direction(o)) : 'No'}<br><span class="muted" style="font-size:.8rem">p ${o.p_value < 0.0001 ? '&lt; 0.0001' : '= ' + o.p_value.toFixed(4)}</span></td>
      </tr>`).join('');

    $('#app').innerHTML = `
      <div class="result-grid">
        <article class="panel" aria-labelledby="res-title">
          <div class="headline">
            <div>
              <h2 id="res-title">${esc(v.name)} at ${esc(placeOf(r.id))}</h2>
              <div class="where">${loc.region ? esc(loc.region) + ' · ' : ''}${fmtMonth(r.start)} – ${fmtMonth(r.end)} · monthly data</div>
            </div>
            ${badge}
          </div>

          <div class="stats">
            <div class="stat"><div class="k">Rate of change</div><div class="v">${TD.fmtNum(r.slope_per_year, 3, true)}</div><div class="s">${esc(v.unit)} per year (${TD.fmtNum(r.slope_per_decade, 3, true)} per decade)</div></div>
            <div class="stat"><div class="k">95% confidence interval</div><div class="v" style="font-size:1.05rem">${TD.fmtNum(r.ci95_per_year[0], 2, true)} to ${TD.fmtNum(r.ci95_per_year[1], 2, true)}</div><div class="s">${esc(v.unit)} per year</div></div>
            <div class="stat"><div class="k">p-value (t-test on slope)</div><div class="v">${TD.fmtP(r.p_value)}</div><div class="s">${r.significant ? 'below' : 'above'} the 0.05 threshold</div></div>
          </div>

          <div class="toolbar">
            <div class="seg" role="group" aria-label="Chart view">
              <button type="button" data-view="anomaly" aria-pressed="${state.view === 'anomaly'}">Trend view</button>
              <button type="button" data-view="value" aria-pressed="${state.view === 'value'}">Raw monthly values</button>
            </div>
            <div class="legend" id="legend"></div>
          </div>
          <div class="chart-box" id="chart"></div>
          <p class="chart-caption" id="chart-caption"></p>

          <div class="plain">
            <h3>What this means in plain language</h3>
            ${plainSummary(r, v)}
          </div>

          ${notes ? `
          <h3 style="margin-top:24px">What the chart shows: the team's visual reading</h3>
          <p class="muted" style="font-size:.9rem">Observations from looking at the seasons-removed chart. A gentle trend can be statistically significant even when it is hard to see by eye under large month-to-month swings.</p>
          <dl class="notes">
            <dt>Overview</dt><dd>${esc(notes.overview)}</dd>
            <dt>Pattern over time</dt><dd>${esc(notes.pattern)}</dd>
            <dt>Extremes (${esc(v.unit)}, relative to normal)</dt><dd>${esc(notes.extremes)}</dd>
          </dl>` : `
          <h3 style="margin-top:24px">What the chart shows</h3>
          <p class="muted"><em>[Placeholder] No written visual analysis has been provided for this location yet.</em></p>`}

          <details class="data-table">
            <summary>Show the data as a table (${r.n_months} months)</summary>
            <div class="table-scroll">
              <table class="compare">
                <caption class="sr-only">Monthly ${esc(v.name)} at ${esc(placeOf(r.id))}</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Value (${esc(v.unit)})</th><th scope="col">Anomaly (${esc(v.unit)})</th></tr></thead>
                <tbody>${r.series.date.map((d, i) => `<tr><td>${fmtMonth(d)}</td><td>${TD.fmtNum(r.series.value[i], 4)}</td><td>${TD.fmtNum(r.series.anomaly[i], 3, true)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </details>
        </article>

        <aside>
          <div class="panel">
            <p class="eyebrow">The variable</p>
            <h3>${esc(v.name)}</h3>
            <p>${esc(v.definition)}</p>
            <p><strong>How NASA measures it:</strong> ${esc(v.howMeasured)}</p>
            <span class="unit-chip">Unit: ${esc(v.unitLong)}</span>
          </div>
          <div class="panel">
            <p class="eyebrow">The place</p>
            <h3>${esc(placeOf(r.id))}${loc.region ? `<span class="muted" style="font-weight:400;font-size:.95rem"> · ${esc(loc.region)}</span>` : ''}</h3>
            <p>${loc.why ? esc(loc.why) : '<em>[Placeholder] No description has been provided for this location yet.</em>'}</p>
            <p class="muted" style="font-size:.88rem">${esc(missingNote)}</p>
          </div>
          <div class="panel">
            <p class="eyebrow">Compare places</p>
            <h3>${esc(v.short)}: every location</h3>
            <p style="font-size:.88rem">The same variable can trend in different directions in different regions. Rates are in ${esc(v.unit)} per year.</p>
            <div class="table-scroll">
              <table class="compare">
                <thead><tr><th scope="col">Place</th><th scope="col">Rate per year</th><th scope="col">Verdict</th></tr></thead>
                <tbody>${compareRows}</tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>`;

    $('#app').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => select(b.dataset.go)));
    $('#app').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      $('#app').querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      drawChart(r, v);
    }));
    drawChart(r, v);
  }

  /* ---------------- Chart (plain SVG, no library) ---------------- */
  function niceTicks(min, max, count = 5) {
    const span = max - min || Math.abs(max) || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toPrecision(12));
    return ticks;
  }
  const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };

  function drawChart(r, v) {
    const box = $('#chart');
    // Draw at the container's real pixel width so text stays readable on phones.
    const W = Math.max(300, Math.round(box.clientWidth || 760));
    const narrow = W < 500;
    const H = narrow ? 280 : 340, M = { t: 16, r: narrow ? 10 : 18, b: 34, l: narrow ? 62 : 74 };
    const isAnom = state.view === 'anomaly';
    const ys = isAnom ? r.series.anomaly : r.series.value;
    const xs = r.series.date.map(monthIndex);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (isAnom) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
    const yt = niceTicks(lo, hi, 5);
    const yMin = yt[0], yMax = yt[yt.length - 1];
    const X = i => M.l + (i - x0) / (x1 - x0) * (W - M.l - M.r);
    const Y = val => M.t + (1 - (val - yMin) / (yMax - yMin)) * (H - M.t - M.b);

    // break the line where months are missing
    let d = '';
    xs.forEach((xi, k) => { d += (k === 0 || xi - xs[k - 1] > 1 ? 'M' : 'L') + X(xi).toFixed(1) + ',' + Y(ys[k]).toFixed(1); });

    const y0 = Math.floor(x0 / 12), y1 = Math.floor(x1 / 12);
    const yearStep = narrow ? 5 : 2;
    let xTicks = '';
    for (let y = Math.ceil(y0 / yearStep) * yearStep; y <= y1; y += yearStep) {
      const px = X(y * 12);
      if (px < M.l - 1) continue;
      xTicks += `<line x1="${px}" x2="${px}" y1="${H - M.b}" y2="${H - M.b + 5}" stroke="#b9b9b0"/><text x="${px}" y="${H - M.b + 20}" text-anchor="middle">${y}</text>`;
    }
    const yTicks = yt.map(t => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#ecece6"/><text x="${M.l - 8}" y="${Y(t) + 4}" text-anchor="end">${TD.fmtNum(t, 3, isAnom)}</text>`).join('');

    const trend = isAnom
      ? `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9a9a92" stroke-width="1"/>
         <path d="M${X(xs[0])},${Y(r.series.trend[0])}L${X(xs[xs.length - 1])},${Y(r.series.trend[r.series.trend.length - 1])}" stroke="#eb6834" stroke-width="2.5" stroke-dasharray="7 5" fill="none"/>`
      : '';

    const label = isAnom ? `Anomaly (${v.unit})` : `${v.short} (${v.unit})`;
    const place = placeOf(r.id);
    const desc = isAnom
      ? `Line chart of monthly ${v.short.toLowerCase()} anomalies at ${place}, ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, ranging from ${TD.fmtNum(Math.min(...ys), 3)} to ${TD.fmtNum(Math.max(...ys), 3)} ${v.unit}. Dashed trend line slopes ${r.slope_per_year > 0 ? 'upward' : 'downward'} at ${TD.fmtRate(r.slope_per_year, v.unit)}.`
      : `Line chart of monthly ${v.short.toLowerCase()} at ${place}, ${fmtMonth(r.start)} to ${fmtMonth(r.end)}, ranging from ${TD.fmtNum(Math.min(...ys), 4)} to ${TD.fmtNum(Math.max(...ys), 4)} ${v.unit}, showing the seasonal cycle.`;

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-t chart-d" tabindex="0">
        <title id="chart-t">${esc(label)} at ${esc(place)}</title>
        <desc id="chart-d">${esc(desc)} Use the left and right arrow keys to read individual months.</desc>
        <g class="axis">${yTicks}${xTicks}
          <text transform="translate(14 ${(H - M.b + M.t) / 2}) rotate(-90)" text-anchor="middle">${esc(label)}</text>
        </g>
        ${trend}
        <path d="${d}" fill="none" stroke="#2a78d6" stroke-width="1.6" stroke-linejoin="round"/>
        ${xs.map((xi, k) => ((k === 0 || xi - xs[k - 1] > 1) && (k === xs.length - 1 || xs[k + 1] - xi > 1))
          ? `<circle cx="${X(xi).toFixed(1)}" cy="${Y(ys[k]).toFixed(1)}" r="2.2" fill="#2a78d6"/>` : '').join('')}
        <g id="hover" style="display:none">
          <line id="hx" y1="${M.t}" y2="${H - M.b}" stroke="#0f1420" stroke-opacity=".35"/>
          <circle id="hc" r="5" fill="#2a78d6" stroke="#fff" stroke-width="2"/>
        </g>
        <rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent" id="hit"/>
      </svg>
      <div class="tooltip" id="tip"></div>`;

    $('#legend').innerHTML = isAnom
      ? `<span><i></i>Monthly anomaly</span><span><i class="trend"></i>Linear trend</span><span><i class="zero"></i>Normal (0)</span>`
      : `<span><i></i>Monthly value</span>`;
    $('#chart-caption').textContent = isAnom
      ? `Each point is how far that month was above or below its usual value for that time of year. Values above zero mean higher than normal.${r.n_missing_fill > 0 ? ' Breaks in the line are months with no data.' : ''}`
      : `Raw monthly values. The regular up-and-down pattern is the seasonal cycle, which is removed before testing for a trend.${r.n_missing_fill > 0 ? ' Breaks in the line are months with no data.' : ''}`;

    const svg = box.querySelector('svg'), tip = $('#tip'), g = $('#hover', svg);
    let cur = -1;
    function show(k) {
      if (k < 0 || k >= xs.length) return;
      cur = k;
      const px = X(xs[k]), py = Y(ys[k]);
      g.style.display = '';
      $('#hx', svg).setAttribute('x1', px); $('#hx', svg).setAttribute('x2', px);
      $('#hc', svg).setAttribute('cx', px); $('#hc', svg).setAttribute('cy', py);
      const rect = svg.getBoundingClientRect(), sc = rect.width / W;
      tip.innerHTML = `<b>${fmtMonth(r.series.date[k])}</b><br>${isAnom ? 'Anomaly' : 'Value'}: ${TD.fmtNum(ys[k], 3, isAnom)} ${esc(v.unit)}`;
      tip.style.left = Math.min(Math.max(px * sc, 70), rect.width - 70) + 'px';
      tip.style.top = (py * sc) + 'px';
      tip.style.opacity = 1;
    }
    function hide() { g.style.display = 'none'; tip.style.opacity = 0; }
    function nearest(clientX) {
      const rect = svg.getBoundingClientRect();
      const mx = (clientX - rect.left) / rect.width * W;
      const target = x0 + (mx - M.l) / (W - M.l - M.r) * (x1 - x0);
      let best = 0, bd = Infinity;
      xs.forEach((xi, k) => { const dd = Math.abs(xi - target); if (dd < bd) { bd = dd; best = k; } });
      return best;
    }
    svg.addEventListener('pointermove', e => show(nearest(e.clientX)));
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(cur < 0 ? (e.key === 'ArrowRight' ? 0 : xs.length - 1) : cur + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(xs.length - 1); }
    });
  }

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (state.series) drawChart(BY_ID[state.series], CONTENT.variables[BY_ID[state.series].variable]); }, 150); });
})();
