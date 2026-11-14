/* Shared helpers: data loading and number formatting. */
(function () {
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

  // Readable number: 3 significant figures, scientific notation for very small/large values.
  function fmtNum(x, sig = 3, signed = false) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    const sign = signed && x > 0 ? '+' : '';
    const ax = Math.abs(x);
    if (ax !== 0 && (ax < 1e-3 || ax >= 1e6)) {
      const [m, e] = x.toExponential(sig - 1).split('e');
      const exp = String(parseInt(e, 10)).split('').map(c => SUP[c]).join('');
      return `${sign}${m.replace('-', '−')} × 10${exp}`;
    }
    let s = Number(x.toPrecision(sig));
    const str = Math.abs(s) >= 1000 ? s.toLocaleString('en-US') : String(s);
    return sign + str.replace('-', '−');
  }

  function fmtRate(slope, unit) {
    return `${fmtNum(slope, 3, true)} ${unit}/year`;
  }

  function fmtP(p) {
    if (p < 0.0001) return '< 0.0001';
    return p.toFixed(4);
  }

  function direction(r, variableId) {
    const up = r.slope_per_year > 0;
    const words = {
      AirTemperature: ['warming', 'cooling'],
      NearSurfaceAirTemperature: ['warming', 'cooling'],
      CloudAmount: ['cloudier', 'less cloudy'],
      RelativeHumidity: ['more humid', 'less humid'],
      RootZoneSoil: ['wetter', 'drier'],
      SurfaceSoilWetness: ['wetter', 'drier'],
      SurfacePressure: ['rising pressure', 'falling pressure'],
      SurfaceWindSpeed: ['windier', 'calmer'],
      TotalPrecipitationRate: ['wetter', 'drier'],
    }[variableId || r.variable] || ['increasing', 'decreasing'];
    return up ? words[0] : words[1];
  }

  function verdictText(r) {
    return r.significant
      ? `significant ${direction(r)} trend (p ${r.p_value < 0.0001 ? '< 0.0001' : '= ' + r.p_value.toFixed(3)})`
      : `no significant trend (p = ${r.p_value.toFixed(2)})`;
  }

  // Fetch JSON with a couple of retries (some simple local servers drop connections).
  async function getJSON(url, tries = 3) {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(url + ' (' + r.status + ')');
        return await r.json();
      } catch (e) {
        if (i >= tries - 1) throw e;
        await new Promise(res => setTimeout(res, 250 * (i + 1)));
      }
    }
  }

  let cache;
  function load() {
    if (!cache) {
      cache = Promise.all([getJSON('data/results.json'), getJSON('data/content.json')])
        .then(([res, content]) => ({ results: res.results, content }));
    }
    return cache;
  }

  window.TD = { fmtNum, fmtRate, fmtP, direction, verdictText, load };
})();
