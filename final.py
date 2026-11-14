from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

def detect_dayfirst(df, date_column="time"):
    first_parts = df[date_column].str.split("-").str[0].astype(int)
    return (first_parts > 12).any()

def YearAverage(item):
    df=pd.read_csv(item)
    df["date"] = pd.to_datetime(df["time"])
    df["date"] = pd.to_datetime(df["time"], dayfirst=True)
    df["year"] = df["date"].dt.year
    yearly_avg = df.groupby("year")["mean"].mean().reset_index()
    plt.plot(yearly_avg["year"], yearly_avg["mean"], marker="o")
    plt.xlabel("Year")
    plt.ylabel("Average Temperature (K)")
    plt.title("Yearly Average Temperature")
    plt.show()

def DeseasonalizedData(item,limit=2):
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
    return df

def Analysis(df):
    x_numeric = (df["date"] - df["date"].iloc[0]).dt.days
    y = df["anomaly"]
    slope, intercept, r_value, p_value, std_err = stats.linregress(x_numeric, y)
    slope_per_year = slope * 365.25
    print(f"Rate of change: {slope_per_year:.4f} units/year")
    print(f"P-value: {p_value:.4f}")
    print(f"Significant: {p_value < 0.05}")

def LoadData(item):
    df=pd.read_csv(item)
    print(df)

def Plot(df,info):    
    variable,location,unit=info
    plt.figure(figsize=(10, 5))
    plt.xlabel("Time")
    plt.ylabel(f"Variation in average value of {variable} ({unit})")
    plt.title(f"{variable}: {location}")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()
    x = df["date"]
    y = df["anomaly"]
    plt.plot(x,y)
    plt.show()

# Guarded so the website build script (build_site_data.py) can import
# DeseasonalizedData without running the plotting loop below.
if __name__ == "__main__":
    directory = Path("C:/Users/Ishaan/Desktop/hilol2")
    for item in directory.iterdir():
        if item.suffix.lower() != ".csv":
            continue
        variablename=item.name.split('_')
        variablename.append('2')
        df=DeseasonalizedData(item)
        Plot(df,variablename)
        Analysis(df)
