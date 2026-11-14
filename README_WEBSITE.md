# Earth System Trend Detective: website

A static website (plain HTML, CSS and JavaScript, no framework and no build step) that presents the analysis in `final.py`.

## What's in the repo

| File / folder | What it is |
|---|---|
| `*.csv` | **Original data, unchanged.** One monthly series per variable and location. |
| `final.py` | Original analysis. Only change: the loop at the bottom now sits under `if __name__ == "__main__":` so other scripts can import `DeseasonalizedData` without it running. Running `python final.py` behaves exactly as before. |
| `trial.py`, `test2.py` | Unchanged. The website does not use them. |
| `build_site_data.py` | **New.** Runs `final.DeseasonalizedData()` and the same `linregress` as `final.Analysis()` on every CSV, then writes `data/results.json`. |
| `data/results.json` | Generated output: series, anomalies, trend line, slope, p-value, R², 95% CI and missing-data counts. |
| `data/content.json` | Website text: variable definitions and place descriptions from *Variables explanation.rtf*, and the chart notes from *Analysis of trends.rtf*. |
| `index.html` | Landing page: the question, method, three demo case files, glossary, and what the results can and cannot tell us. |
| `explore.html` + `assets/explore.js` | The explorer. Three guided questions (topic → variable → place), then the chart, verdict, plain-language summary and comparison table. |
| `assets/style.css`, `assets/common.js` | Shared styles and helpers. |
| `vercel.json` | Vercel settings (clean URLs, caching). |

## Run it locally

The pages load JSON files, so open them through a local web server, not by double-clicking:

```bash
python -m http.server 8000
```

Then go to http://localhost:8000.

If you change or add a CSV, regenerate the data and commit `data/results.json`:

```bash
python build_site_data.py
```

New CSVs must be named `Variable_Location.csv`. The variable also needs an entry in `data/content.json`.

## Deploy on Vercel (free Hobby plan)

Vercel serves the folder as-is. It doesn't run Python, which is why `data/results.json` is committed.

1. **Put these files on GitHub.** Commit all of them to `IshaanKedarPande/hilol`, including `data/`, `assets/`, `index.html`, `explore.html`, `vercel.json` and `build_site_data.py`.
   - With Git: `git add .`, then `git commit -m "Add website"`, then `git push`.
   - Without Git: on the repo page, choose **Add file → Upload files**, drag in the files and folders, then click **Commit changes**.
2. Go to https://vercel.com and choose **Sign up → Continue with GitHub**.
3. Click **Add New… → Project**. Find `hilol` and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to the repo. If the repo belongs to a teammate's account, that teammate must do this step, or add you as a collaborator.
4. On the configure screen:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** leave empty (turn the override on and leave the field blank if Vercel fills one in)
   - **Output Directory:** leave empty (it serves the repository root)
   - **Install Command:** leave empty
5. Click **Deploy**. After about 30 seconds you get a URL like `https://hilol-xxxx.vercel.app`.
6. Optional: under **Settings → Domains**, change it to something like `trend-detective.vercel.app`.
7. From now on, every push to `main` redeploys automatically.

Before you submit, open the live site and check: the landing page shows "9 of 23" significant trends; each case-file button opens the explorer; and the explorer chart draws.

## Items for the team to review

See the summary in the chat or the list below. **None of these were resolved by assumption in the analysis.**

1. **Units are not in the data files.** The site shows units inferred from the value ranges: K for temperature, Pa for pressure, m/s for wind, % for relative humidity, kg m⁻² s⁻¹ for precipitation, and a 0–1 fraction for cloud and soil wetness. Confirm or correct them in `data/content.json`.
2. **Data source is not stated anywhere.** The footer has a labelled placeholder. Add the product names (for example MERRA-2 or GLDAS, via Giovanni) and the grid point or area used for each location.
3. **Thar Desert air temperature:** 119 of 241 months are −9999, almost every April–September. The site shows a caution note. `interpolate(limit=2)` also fills the first two months of each long gap (April and May) from the March and October values, so those months are synthetic.
4. **Oodnadatta:** 16 months are missing, mostly Januaries (peak summer), and are filled by interpolation. The site shows a caution note.
5. **Snow depth CSVs are missing.** `trial.py` lists `SnowDepth_Brooks/Sierra/Tohoku.csv`, but they aren't in the repo. Snow depth is therefore not on the site.
6. **Text without data:** the explanation file also covers specific humidity, daily minimum temperature, aerosol optical depth and several places with no CSV (Vostok, Atacama, Cape Horn, Gran Chaco, Mount Washington, Dras, Snag, Peter Sinks). They are left out of the site.
7. **Data without text:** `SurfaceWindSpeed_Denison.csv` has no place description (labelled placeholder on the site). `RelativeHumidity_Reyes` has no written chart analysis (labelled placeholder).
8. **"Barrow" is ambiguous.** The description says Barrow *Island* (Australia, cyclone gust record). Barrow, Alaska (Utqiaġvik) is also a well-known site. Check which coordinates were used.
9. **"AirTemperature" files:** the text describes them as *daily maximum* temperature, but the CSVs are monthly. Confirm what each monthly value is (a monthly mean of daily maxima?).
10. **Written analysis vs. statistics.** Several notes say "no distinct long-term trend", but the regression finds a significant trend: Thar, Everest and Tosontsengel pressure, and Pantanal. On the site these notes are labelled as the team's *visual reading*, the wording says "visible by eye", and a sentence explains that a small trend can be significant without being obvious. Re-word them if you prefer.
11. **Duplicate analysis:** Furnace Creek has two notes in *Analysis of trends* (`Furnace` and `Furnace_2`). The first is used. The notes also say "2005", but the data starts in January 2006, so the site says "the start of the record".
12. **`trial.py` vs `final.py`:** `trial.py` averages *raw* values across very different places (for example Dead Sea + Everest pressure), doesn't remove −9999 or the seasons, and gives different results. The site uses `final.py` only.
13. **Autocorrelation:** `linregress` treats months as independent. Several series show multi-year cycles, so p-values may be too optimistic. The "Limits" section says so. A Mann-Kendall test or an autocorrelation-adjusted test would be the next step if you want to strengthen this.
14. **Additions beyond `final.py`:** the 95% confidence interval and R² come from `linregress`'s own `std_err` and `r_value`. Region labels (for example "Outback, Australia") were added for geographic context; check them in `data/content.json`.
