public sealed class DailyWeather
{
    public List<string> Time { get; set; } = new();
    public List<double> TempMax { get; set; } = new();
    public List<double> TempMin { get; set; } = new();
    public List<double> PrecipSum { get; set; } = new();

    public List<DailyRecord> ToRecords()
    {
        var n = Time.Count;
        var records = new List<DailyRecord>(n);

        for (int i = 0; i < n; i++)
        {
            records.Add(new DailyRecord
            {
                Date = Time[i],
                TMax = i < TempMax.Count ? TempMax[i] : 0,
                TMin = i < TempMin.Count ? TempMin[i] : 0,
                PrecipMm = i < PrecipSum.Count ? PrecipSum[i] : 0
            });
        }

        return records;
    }
}

public sealed class WeatherResponse
{
    public string City { get; set; } = "";
    public Coords Coords { get; set; } = new();
    public DateRange Range { get; set; } = new();
    public List<DailyRecord> Daily { get; set; } = new();
    public Summary Summary { get; set; } = new();
    public Trends Trends { get; set; } = new();
}

public sealed class Coords { public double Lat { get; set; } public double Lon { get; set; } }
public sealed class DateRange { public string Start { get; set; } = ""; public string End { get; set; } = ""; }

public sealed class DailyRecord
{
    public string Date { get; set; } = "";
    public double TMin { get; set; }
    public double TMax { get; set; }
    public double PrecipMm { get; set; }
}

public sealed class Summary
{
    public double? AvgTempC { get; set; }
    public double? MinTempC { get; set; }
    public double? MaxTempC { get; set; }
    public double TotalPrecipMm { get; set; }
    public int RainyDays { get; set; }
}

public sealed class Trends
{
    public double? TempChangeC { get; set; }
    public string? TrendLabel { get; set; }
    public double? MostRainMm { get; set; }
    public string? MostRainDate { get; set; }
}
