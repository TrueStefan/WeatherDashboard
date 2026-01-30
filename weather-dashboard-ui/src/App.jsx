import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { start: formatDate(start), end: formatDate(end) };
}

function numOrDash(x) {
  if (x === null || x === undefined) return "—";
  const n = Number(x);
  return Number.isFinite(n) ? x : "—";
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function movingAverage(values, windowSize = 7) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let cnt = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      if (j >= 0) {
        const v = values[j];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          sum += v;
          cnt++;
        }
      }
    }
    out.push(cnt === 0 ? null : +(sum / cnt).toFixed(2));
  }
  return out;
}

export default function App() {
  const r = useMemo(() => defaultRange(), []);
  const [city, setCity] = useState("Toronto");
  const [start, setStart] = useState(r.start);
  const [end, setEnd] = useState(r.end);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // KEY: bump key on resize to avoid Chart.js “stuck size” after fullscreen toggles
  const [chartKey, setChartKey] = useState(0);
  useEffect(() => {
    let t = null;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setChartKey((k) => k + 1), 120);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function load() {
    setErr("");
    setLoading(true);

    try {
      const qs = new URLSearchParams({ city, start, end });
      const res = await fetch(`/api/weather?${qs.toString()}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const cityLabel = data?.city || city || "—";
  const rangeLabel = data?.range
    ? `${data.range.start} → ${data.range.end}`
    : `${start} → ${end}`;

  const daily = data?.daily || [];
  const labels = daily.map((d) => d.date);

  const tMin = daily.map((d) => toNum(d.tMin ?? d.minTemp ?? d.min));
  const tMax = daily.map((d) => toNum(d.tMax ?? d.maxTemp ?? d.max));
  const precip = daily.map((d) => toNum(d.precipMm ?? d.precip));

  const avgTemp = daily.map((_, i) => {
    const a = tMin[i];
    const b = tMax[i];
    if (a === null || b === null) return null;
    return +(((a + b) / 2).toFixed(2));
  });
  const avgTempMA = movingAverage(avgTemp, 7);

  const gridColor = "rgba(255,255,255,0.12)";
  const tickColor = "rgba(255,255,255,0.82)";
  const legendColor = "rgba(255,255,255,0.90)";
  const tooltipBg = "rgba(15, 23, 42, 0.92)";

  const chartData = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Precip (mm)",
        data: precip,
        yAxisID: "yP",
        borderWidth: 0,
        backgroundColor: "rgba(120, 160, 255, 0.35)",
        hoverBackgroundColor: "rgba(120, 160, 255, 0.55)",
        borderRadius: 6,
        barPercentage: 0.9,
        categoryPercentage: 0.85,
      },
      {
        type: "line",
        label: "Max Temp (°C)",
        data: tMax,
        yAxisID: "yT",
        tension: 0.3,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderColor: "rgba(255, 205, 86, 0.95)",
        pointBackgroundColor: "rgba(255, 205, 86, 0.95)",
      },
      {
        type: "line",
        label: "Min Temp (°C)",
        data: tMin,
        yAxisID: "yT",
        tension: 0.3,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderColor: "rgba(99, 214, 255, 0.95)",
        pointBackgroundColor: "rgba(99, 214, 255, 0.95)",
      },
      {
        type: "line",
        label: "Avg Temp (7d MA)",
        data: avgTempMA,
        yAxisID: "yT",
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2.5,
        borderDash: [6, 6],
        borderColor: "rgba(255,255,255,0.86)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    // KEY: helps prevent glitchy resizes
    normalized: true,
    resizeDelay: 150,
    animation: false,

    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        labels: {
          color: legendColor,
          boxWidth: 14,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "rectRounded",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: tooltipBg,
        titleColor: "rgba(255,255,255,0.92)",
        bodyColor: "rgba(255,255,255,0.90)",
        borderColor: "rgba(255,255,255,0.18)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: tickColor,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
        },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      yT: {
        position: "left",
        ticks: { color: tickColor },
        grid: { color: gridColor },
        title: {
          display: true,
          text: "Temperature (°C)",
          color: "rgba(255,255,255,0.75)",
        },
      },
      yP: {
        position: "right",
        ticks: { color: tickColor },
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: "Precipitation (mm)",
          color: "rgba(255,255,255,0.75)",
        },
      },
    },
  };

  return (
    <div className="container">
      <div className="header">
        <div className="titleBlock">
          <h1>Weather Trends</h1>
          <p>Historical weather summaries + trend insights by city and date range.</p>
        </div>
        <div className="chip">
          <span>API:</span>
          <b>localhost:5031</b>
        </div>
      </div>

      <div className="panel controls">
        <label className="label">
          City
          <input
            className="input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Toronto"
          />
        </label>

        <label className="label">
          Start
          <input
            className="input"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>

        <label className="label">
          End
          <input
            className="input"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>

        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {err && (
        <div className="alert">
          <b>Error:</b> {err}
        </div>
      )}

      {data && (
        <div className="row">
          <div className="panel section">
            <div className="sectionHeader">
              <h2>{cityLabel}</h2>
              <div className="sub">{rangeLabel}</div>
            </div>

            <div className="kpis">
              <Kpi title="Avg Temp (°C)" value={numOrDash(data.summary?.avgTempC)} />
              <Kpi title="Min Temp (°C)" value={numOrDash(data.summary?.minTempC)} />
              <Kpi title="Max Temp (°C)" value={numOrDash(data.summary?.maxTempC)} />
              <Kpi title="Total Precip (mm)" value={numOrDash(data.summary?.totalPrecipMm)} />
              <Kpi title="Rainy Days" value={numOrDash(data.summary?.rainyDays)} />
              <Kpi title="Trend" value={data.trends?.trendLabel ?? "—"} />
            </div>
          </div>

          <div className="panel chartWrap">
            <div className="sectionHeader" style={{ padding: "0 2px 10px" }}>
              <h2>Temperature + precipitation</h2>
              <div className="sub">Min/Max + precip bars + 7-day avg</div>
            </div>

            <div className="chartBox">
              <Chart key={chartKey} type="bar" data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="panel section" style={{ gridColumn: "1 / -1" }}>
            <div className="sectionHeader">
              <h2>Daily data</h2>
              <div className="sub">{daily.length} days</div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 110 }}>Date</th>
                    <th className="num">Min (°C)</th>
                    <th className="num">Max (°C)</th>
                    <th className="num">Precip (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td className="num">{numOrDash(d.tMin ?? d.minTemp ?? d.min)}</td>
                      <td className="num">{numOrDash(d.tMax ?? d.maxTemp ?? d.max)}</td>
                      <td className="num">{numOrDash(d.precipMm ?? d.precip)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!data && !err && (
        <div className="panel section" style={{ marginTop: 14 }}>
          <div className="sectionHeader">
            <h2>Load a city to begin</h2>
            <div className="sub">Example: Toronto, London, New York</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="card">
      <div className="k">{title}</div>
      <div className="v">{value}</div>
    </div>
  );
}
