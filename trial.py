import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats

def average_locations(csv_paths):
    location_frames = []

    for i, path in enumerate(csv_paths):
        df = pd.read_csv(path, parse_dates=[0])
        time_col = df.columns[0]
        value_col = df.columns[1]

        df = df[[time_col, value_col]].rename(
            columns={time_col: "time", value_col: f"value_{i}"}
        )
        location_frames.append(df)

    merged = location_frames[0]
    for df in location_frames[1:]:
        merged = pd.merge(merged, df, on="time", how="outer")

    merged = merged.sort_values("time")

    value_cols = [c for c in merged.columns if c.startswith("value_")]
    merged["average_value"] = merged[value_cols].mean(axis=1, skipna=True)
    merged = merged.dropna(subset=["average_value"])
    return merged[["time", "average_value"]]


def plot_variable_trend(variable_name, csv_paths, unit=""):
    df = average_locations(csv_paths)
    x_numeric = (df["time"] - df["time"].iloc[0]).dt.days
    y = df["average_value"]
    slope, intercept, r_value, p_value, std_err = stats.linregress(x_numeric, y)
    slope_per_year = slope * 365.25
    trend_line = intercept + slope * x_numeric

    plt.figure(figsize=(10, 5))
    plt.plot(df["time"], y, label="3-location average", color="steelblue", linewidth=1.5)
    plt.plot(df["time"], trend_line, label="Linear trend", color="red",
              linestyle="--", linewidth=2)

    plt.xlabel("Time")
    plt.ylabel(f"{variable_name} ({unit})" if unit else variable_name)
    plt.title(f"{variable_name}: average across 3 locations")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()

    significance = "statistically significant" if p_value < 0.05 else "not statistically significant"
    print(f"{variable_name}: {slope_per_year:.4f} {unit}/year, p = {p_value:.4f} ({significance})")

    return {
        "variable": variable_name,
        "slope_per_year": slope_per_year,
        "p_value": p_value,
        "r_squared": r_value**2,
        "significant": p_value < 0.05,
    }

variable_files = {
    "Air Temperature":            ["AirTemperature_Oodnadatta.csv", "AirTemperature_Thar.csv"],
    "Cloud Amount":                ["CloudAmount_Bouvet.csv", "CloudAmount_Nauru.csv"],
    "Near Surface Air Temperature": ["NearSurfaceAirTemperature_Dallol.csv", "NearSurfaceAirTemperature_Furnace.csv"],
    "Relative Humidity":           ["RelativeHumidity_Monteverde.csv", "RelativeHumidity_Reyes.csv"],
    "Root Zone Soil Moisture":     ["RootZoneSoil_Pantanal.csv", "RootZoneSoil_Sudd.csv", "RootZoneSoil_Walnut.csv"],
    "Snow Depth":                  ["SnowDepth_Brooks.csv", "SnowDepth_Sierra.csv", "SnowDepth_Tohoku.csv"],
    "Surface Pressure":            ["SurfacePressure_DeadSea.csv", "SurfacePressure_Everest.csv", "SurfacePressure_Tosontsengel.csv"],
    "Surface Soil Wetness":        ["SurfaceSoilWetness_Kuch.csv", "SurfaceSoilWetness_MonteBuey.csv", "SurfaceSoilWetness_Remedhus.csv"],
    "Surface Wind Speed":          ["SurfaceWindSpeed_Barrow.csv", "SurfaceWindSpeed_Denison.csv", "SurfaceWindSpeed_Southcol.csv"],
    "Total Precipitation Rate":    ["TotalPrecipitationRate_Mawsynram.csv", "TotalPrecipitationRate_Tutunendo.csv", "TotalPrecipitationRate_Waialeale.csv"],
}

all_results = []
for variable_name, paths in variable_files.items():
    result = plot_variable_trend(variable_name, paths)
    all_results.append(result)

summary_df = pd.DataFrame(all_results)
print(summary_df)