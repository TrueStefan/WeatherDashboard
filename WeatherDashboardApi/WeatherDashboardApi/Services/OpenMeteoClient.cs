using System.Net.Http.Json;
using System.Text.Json.Serialization;

public sealed class OpenMeteoClient
{
    private readonly HttpClient _http;

    public OpenMeteoClient(HttpClient http) => _http = http;

    public async Task<GeoResult?> GeocodeCityAsync(string city)
    {
        var url = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(city)}&count=5&language=en&format=json";
        var resp = await _http.GetFromJsonAsync<GeocodeResponse>(url);

        var best = resp?.Results?
            .OrderByDescending(r => r.Population ?? 0)
            .FirstOrDefault();

        if (best == null) return null;

        return new GeoResult
        {
            Latitude = best.Latitude,
            Longitude = best.Longitude,
            DisplayName = $"{best.Name}{(string.IsNullOrWhiteSpace(best.Admin1) ? "" : $", {best.Admin1}")}, {best.CountryCode}"
        };
    }

    public async Task<DailyWeather> GetDailyAsync(double lat, double lon, DateOnly start, DateOnly end)
    {
        var url =
            "https://archive-api.open-meteo.com/v1/archive" +
            $"?latitude={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            $"&longitude={lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            $"&start_date={start:yyyy-MM-dd}&end_date={end:yyyy-MM-dd}" +
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
            "&timezone=auto";

        var resp = await _http.GetFromJsonAsync<ArchiveResponse>(url);

        if (resp?.Daily?.Time == null)
            return new DailyWeather();

        return new DailyWeather
        {
            Time = resp.Daily.Time,
            TempMax = resp.Daily.TemperatureMax ?? new(),
            TempMin = resp.Daily.TemperatureMin ?? new(),
            PrecipSum = resp.Daily.PrecipitationSum ?? new()
        };
    }

    // --- DTOs for Open-Meteo ---
    private sealed class GeocodeResponse
    {
        [JsonPropertyName("results")] public List<GeoDto>? Results { get; set; }
    }

    private sealed class GeoDto
    {
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("admin1")] public string? Admin1 { get; set; }
        [JsonPropertyName("country_code")] public string CountryCode { get; set; } = "";
        [JsonPropertyName("latitude")] public double Latitude { get; set; }
        [JsonPropertyName("longitude")] public double Longitude { get; set; }
        [JsonPropertyName("population")] public int? Population { get; set; }
    }

    private sealed class ArchiveResponse
    {
        [JsonPropertyName("daily")] public DailyDto? Daily { get; set; }
    }

    private sealed class DailyDto
    {
        [JsonPropertyName("time")] public List<string>? Time { get; set; }

        [JsonPropertyName("temperature_2m_max")]
        public List<double>? TemperatureMax { get; set; }

        [JsonPropertyName("temperature_2m_min")]
        public List<double>? TemperatureMin { get; set; }

        [JsonPropertyName("precipitation_sum")]
        public List<double>? PrecipitationSum { get; set; }
    }
}

public sealed class GeoResult
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string DisplayName { get; set; } = "";
}
