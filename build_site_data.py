"""Build the data file used by the website (data/results.json).

Reuses the team's analysis from final.py:
  * DeseasonalizedData()  -> cleans -9999 fill values, interpolates short gaps
                             (limit=2), removes the monthly climatology
  * the same scipy.stats.linregress call as final.Analysis()
    (slope in units/day * 365.25 = units/year, significant if p < 0.05)

The only additions are values that linregress already returns (std_err,
r_value) turned into a 95% confidence interval and R^2, plus bookkeeping
(date range, number of months, number of missing -9999 months).

Run from the repository root:   python build_site_data.py
"""
from pathlib import Path
import json

import numpy as np
import pandas as pd
from scipy import stats

from final import DeseasonalizedData

ROOT = Path(__file__).parent
OUT = ROOT / "data" / "results.json"


def sig6(v) -> float:
    return float(f"{float(v):.6g}")


def analyse(path: Path) -> dict:
    variable, location = path.stem.split("_", 1)

    raw = pd.read_csv(path)
    fill_mask = pd.to_numeric(raw["mean"], errors="coerce") == -9999
    missing = int(fill_mask.sum())
    raw_dates = pd.to_datetime(raw["time"], dayfirst=True)
    missing_by_month = {int(m): int(c) for m, c in raw_dates[fill_mask].dt.month.value_counts().sort_index().items()}

    df = DeseasonalizedData(path)

    # Same regression as final.Analysis()
    x_days = (df["date"] - df["date"].iloc[0]).dt.days
    y = df["anomaly"]
    slope, intercept, r_value, p_value, std_err = stats.linregress(x_days, y)
    slope_per_year = slope * 365.25
    se_per_year = std_err * 365.25

    n = len(df)
    t_crit = stats.t.ppf(0.975, n - 2)
    ci = [slope_per_year - t_crit * se_per_year, slope_per_year + t_crit * se_per_year]

    trend = intercept + slope * x_days

    return {
        "id": path.stem,
        "file": path.name,
        "variable": variable,
        "location": location,
        "start": df["date"].iloc[0].strftime("%Y-%m"),
        "end": df["date"].iloc[-1].strftime("%Y-%m"),
        "n_months": n,
        "n_rows_in_file": int(len(raw)),
        "n_missing_fill": missing,
        "missing_by_calendar_month": missing_by_month,
        "slope_per_year": slope_per_year,
        "slope_per_decade": slope_per_year * 10,
        "std_err_per_year": se_per_year,
        "ci95_per_year": ci,
        "p_value": p_value,
        "r_squared": r_value ** 2,
        "significant": bool(p_value < 0.05),
        "series": {
            "date": df["date"].dt.strftime("%Y-%m").tolist(),
            # 6 significant figures keeps the file small without losing precision
            "value": [sig6(v) for v in df["mean"]],
            "anomaly": [sig6(v) for v in y],
            "trend": [sig6(v) for v in trend],
        },
    }


def main():
    results = []
    for path in sorted(ROOT.glob("*.csv")):
        dates = pd.read_csv(path)["time"].astype(str)
        days = dates.str.split("-").str[0].astype(int)
        if (days != 1).any():
            print(f"WARNING {path.name}: not every row is the 1st of a month - check date format")
        r = analyse(path)
        results.append(r)
        print(f"{r['id']:<40} {r['start']}..{r['end']}  n={r['n_months']:<4} "
              f"missing={r['n_missing_fill']:<3} slope/yr={r['slope_per_year']:+.5g}  "
              f"p={r['p_value']:.4f}  sig={r['significant']}  "
              f"raw range={min(r['series']['value']):.4g}..{max(r['series']['value']):.4g}")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"results": results}, separators=(",", ":")), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(results)} series)")


if __name__ == "__main__":
    main()
