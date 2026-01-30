using System.Globalization;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddHttpClient<OpenMeteoClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    // optional: set a user-agent for politeness
    client.DefaultRequestHeaders.UserAgent.ParseAdd("WeatherTrendsDashboard/1.0");
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();
app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/weather", async (
    string city,
    string start,
    string end,
    OpenMeteoClient client) =>
{
    if (string.IsNullOrWhiteSpace(city))
        return Results.BadRequest(new { error = "city is required" });

    if (!DateOnly.TryParseExact(start, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var startDate))
        return Results.BadRequest(new { error = "start must be yyyy-MM-dd" });

    if (!DateOnly.TryParseExact(end, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var endDate))
        return Results.BadRequest(new { error = "end must be yyyy-MM-dd" });

    if (endDate < startDate)
        return Results.BadRequest(new { error = "end must be >= start" });

    // Keep ranges reasonable (helps reliability & prevents accidental huge queries)
    if (endDate.DayNumber - startDate.DayNumber > 370)
        return Results.BadRequest(new { error = "date range too large (max ~370 days)" });

    var geo = await client.GeocodeCityAsync(city.Trim());
    if (geo is null)
        return Results.NotFound(new { error = $"city not found: {city}" });

    var daily = await client.GetDailyAsync(geo.Latitude, geo.Longitude, startDate, endDate);

    // Compute summary + trends (simple, explainable)
    var result = WeatherAnalytics.BuildResponse(city: geo.DisplayName, geo, daily, startDate, endDate);

    return Results.Ok(result);
});

app.Run();


// ------- analytics helpers (keep in Program.cs for now; extract later if you want) -------
static class WeatherAnalytics
{
    public static WeatherResponse BuildResponse(
        string city,
        GeoResult geo,
        DailyWeather daily,
        DateOnly start,
        DateOnly end)
    {
        var records = daily.ToRecords();

        double? avgTemp = records.Count == 0 ? null : records.Average(r => (r.TMin + r.TMax) / 2.0);
        double? minTemp = records.Count == 0 ? null : records.Min(r => r.TMin);
        double? maxTemp = records.Count == 0 ? null : records.Max(r => r.TMax);
        double totalPrecip = records.Sum(r => r.PrecipMm);
        int rainyDays = records.Count(r => r.PrecipMm > 0.0);

        // Trend: avg(last 3 days) - avg(first 3 days) using mean temp
        double? tempChange = null;
        string? trendLabel = null;
        if (records.Count >= 6)
        {
            double first = records.Take(3).Average(r => (r.TMin + r.TMax) / 2.0);
            double last = records.TakeLast(3).Average(r => (r.TMin + r.TMax) / 2.0);
            tempChange = Math.Round(last - first, 2);
            trendLabel = tempChange > 0.5 ? "warming"
                       : tempChange < -0.5 ? "cooling"
                       : "stable";
        }

        var mostRain = records.OrderByDescending(r => r.PrecipMm).FirstOrDefault();
        return new WeatherResponse
        {
            City = city,
            Coords = new Coords { Lat = geo.Latitude, Lon = geo.Longitude },
            Range = new DateRange { Start = start.ToString("yyyy-MM-dd"), End = end.ToString("yyyy-MM-dd") },
            Daily = records,
            Summary = new Summary
            {
                AvgTempC = avgTemp is null ? null : Math.Round(avgTemp.Value, 2),
                MinTempC = minTemp is null ? null : Math.Round(minTemp.Value, 2),
                MaxTempC = maxTemp is null ? null : Math.Round(maxTemp.Value, 2),
                TotalPrecipMm = Math.Round(totalPrecip, 2),
                RainyDays = rainyDays
            },
            Trends = new Trends
            {
                TempChangeC = tempChange,
                TrendLabel = trendLabel,
                MostRainMm = mostRain is null ? null : Math.Round(mostRain.PrecipMm, 2),
                MostRainDate = mostRain?.Date
            }
        };
    }
}
