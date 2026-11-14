from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

def detect_dayfirst(df, date_column="time"):
    first_parts = df[date_column].str.split("-").str[0].astype(int)
    return (first_parts > 12).any()

directory = Path("C:/Users/Ishaan/Desktop/hilol2")
for item in directory.iterdir():
    if item.suffix.lower() != ".csv":
        continue
    print(f"Processing: {item.name}")
    df=pd.read_csv(item)
    df["date"] = pd.to_datetime(df["time"])
    df["date"] = pd.to_datetime(df["time"], dayfirst=True)
    df["mean"] = pd.to_numeric(df["mean"], errors="coerce")
    df["mean"] = df["mean"].replace(-9999, np.nan)
    df = df.set_index("date")
    df["mean"] = df["mean"].interpolate(method="time", limit=2)
    df = df.dropna(subset=["mean"])
    df = df.reset_index()

    df["month"] = df["date"].dt.month
    monthly_climatology = df.groupby("month")["mean"].transform("mean")
    df["anomaly"] = df["mean"] - monthly_climatology

    ''' print(df[["time", "date", "month"]].head(20))'''
    x = df["date"]
    y = df["anomaly"]
    plt.plot(x, y)
    plt.show()

    x_numeric = (df["date"] - df["date"].iloc[0]).dt.days
    y = df["anomaly"]

    slope, intercept, r_value, p_value, std_err = stats.linregress(x_numeric, y)
    slope_per_year = slope * 365.25

    print(f"Rate of change: {slope_per_year:.4f} units/year")
    print(f"P-value: {p_value:.4f}")
    print(f"Significant: {p_value < 0.05}")
