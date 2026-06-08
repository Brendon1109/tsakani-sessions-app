"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Eye,
  MousePointerClick,
  MapPin,
  CalendarClock,
  Loader2,
  Sparkles,
} from "lucide-react";

interface SeriesPoint {
  date: string;
  value: number;
}
interface Entry {
  key: string;
  count: number;
}
interface Analytics {
  rangeDays: number;
  truncated: boolean;
  totals: {
    events: number;
    pageViews: number;
    uniqueVisitors: number;
    conversions: number;
  };
  series: { pageViews: SeriesPoint[]; conversions: SeriesPoint[] };
  forecast: {
    pageViews14: SeriesPoint[];
    projectedConversions30: number;
    busiestWeekday: { label: string; average: number } | null;
    busiestMonth: { label: string; total: number } | null;
    trend: { direction: "up" | "down" | "flat"; pctChange: number };
  };
  local: {
    topCities: Entry[];
    topRegions: Entry[];
    capeTownShare: number;
    geoKnown: number;
  };
  topServices: Entry[];
  topEvents: Entry[];
  topReferrers: Entry[];
  devices: Entry[];
  funnel: { step: string; value: number }[];
}

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6m", days: 180 },
];

function Chart({
  history,
  forecast,
}: {
  history: SeriesPoint[];
  forecast: SeriesPoint[];
}) {
  const all = [...history, ...forecast];
  if (all.length === 0) return null;
  const W = 720;
  const H = 160;
  const pad = 8;
  const max = Math.max(1, ...all.map((p) => p.value));
  const stepX = (W - pad * 2) / Math.max(1, all.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (pts: SeriesPoint[], offset: number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i + offset)},${y(p.value)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-40"
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily page views with 14-day forecast"
    >
      <path
        d={line(history, 0)}
        fill="none"
        stroke="#ffd700"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {forecast.length > 0 && history.length > 0 && (
        <path
          d={`M${x(history.length - 1)},${y(history[history.length - 1].value)} ` +
            line(forecast, history.length).slice(1)}
          fill="none"
          stroke="#ffd700"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function Bars({ entries }: { entries: Entry[] }) {
  if (entries.length === 0)
    return <p className="text-gray-500 text-sm">No data yet.</p>;
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <div className="space-y-2.5">
      {entries.map((e) => (
        <div key={e.key} className="flex items-center gap-3">
          <span className="text-sm text-gray-300 w-32 truncate" title={e.key}>
            {e.key}
          </span>
          <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gold-gradient h-full rounded-full"
              style={{ width: `${(e.count / max) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-400 w-10 text-right">{e.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const TrendIcon =
    data?.forecast.trend.direction === "up"
      ? TrendingUp
      : data?.forecast.trend.direction === "down"
        ? TrendingDown
        : Minus;

  const tiles = [
    {
      label: "Page Views",
      value: data?.totals.pageViews ?? "—",
      icon: Eye,
      color: "text-gold-500",
    },
    {
      label: "Unique Visitors",
      value: data?.totals.uniqueVisitors ?? "—",
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Conversions",
      value: data?.totals.conversions ?? "—",
      icon: MousePointerClick,
      color: "text-green-400",
    },
    {
      label: "Cape Town Share",
      value: data ? `${data.local.capeTownShare}%` : "—",
      icon: MapPin,
      color: "text-orange-400",
    },
  ];

  const noData = data && data.totals.events === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Local Analytics</h1>
          <p className="text-gray-400 mt-1">
            First-party traffic, demand &amp; forecasts — Cape Town
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <Loader2 size={18} className="text-gold-500 animate-spin" aria-label="Loading" />
          )}
          <div className="flex bg-dark-500 border border-white/10 rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  days === r.days
                    ? "bg-gold-500/15 text-gold-500 font-medium"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <p className="text-red-400 font-medium">Failed to load analytics</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
          <p className="text-gray-500 text-xs mt-3">
            If this says &quot;not configured&quot; the analytics table may not be
            created yet — run supabase/analytics_events.sql.
          </p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.label}
                  className="bg-dark-500 border border-white/10 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-gray-400 text-sm truncate">{t.label}</p>
                      <p className="text-2xl font-bold mt-1">{t.value}</p>
                    </div>
                    <div className={`${t.color} bg-white/5 p-2.5 rounded-lg shrink-0`}>
                      <Icon size={22} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {noData && (
            <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-6 mb-6 flex items-start gap-3">
              <Sparkles size={18} className="text-gold-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Collecting data…</p>
                <p className="text-gray-400 text-sm mt-1">
                  No events recorded in this window yet. Forecasts and demand
                  insights will appear here as visitors browse the site.
                </p>
              </div>
            </div>
          )}

          {/* Trend chart + forecast */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Page Views &amp; 14-Day Forecast</h2>
              {data && (
                <span
                  className={`text-sm font-medium flex items-center gap-1 ${
                    data.forecast.trend.direction === "up"
                      ? "text-green-400"
                      : data.forecast.trend.direction === "down"
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  <TrendIcon size={16} />
                  {data.forecast.trend.direction === "flat"
                    ? "Stable"
                    : `${Math.abs(Math.round(data.forecast.trend.pctChange))}% ${
                        data.forecast.trend.direction
                      }`}
                </span>
              )}
            </div>
            {data && (
              <Chart
                history={data.series.pageViews}
                forecast={data.forecast.pageViews14}
              />
            )}
            <p className="text-xs text-gray-500 mt-2">
              Solid = actual · dashed = forecast (linear trend + day-of-week
              seasonality)
            </p>
          </div>

          {/* Predictions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gold-500 mb-2">
                <CalendarClock size={18} />
                <p className="text-sm font-medium">Busiest Day</p>
              </div>
              <p className="text-xl font-bold">
                {data?.forecast.busiestWeekday?.label ?? "—"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {data?.forecast.busiestWeekday
                  ? `~${data.forecast.busiestWeekday.average.toFixed(1)} views/day avg`
                  : "Not enough data"}
              </p>
            </div>
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gold-500 mb-2">
                <CalendarClock size={18} />
                <p className="text-sm font-medium">Peak Month</p>
              </div>
              <p className="text-xl font-bold">
                {data?.forecast.busiestMonth?.label ?? "—"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {data?.forecast.busiestMonth
                  ? `${data.forecast.busiestMonth.total} views in range`
                  : "Not enough data"}
              </p>
            </div>
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 text-gold-500 mb-2">
                <TrendingUp size={18} />
                <p className="text-sm font-medium">Projected Demand (30d)</p>
              </div>
              <p className="text-xl font-bold">
                {data?.forecast.projectedConversions30 ?? "—"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                forecast booking/contact actions
              </p>
            </div>
          </div>

          {/* Local demand + services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-gold-500" />
                Local Demand — Top Cities
              </h2>
              <Bars entries={data?.local.topCities ?? []} />
            </div>
            <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
              <h2 className="font-bold mb-4">Service Interest</h2>
              <Bars entries={data?.topServices ?? []} />
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="font-bold mb-4">Conversion Funnel</h2>
            <div className="space-y-3">
              {(data?.funnel ?? []).map((f, i) => {
                const top = data?.funnel[0]?.value || 1;
                const pct = Math.round((f.value / top) * 100);
                return (
                  <div key={f.step}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300">
                        {i + 1}. {f.step}
                      </span>
                      <span className="text-gray-400">
                        {f.value} {i > 0 && `(${pct}%)`}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gold-gradient h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Secondary lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
              <h2 className="font-bold mb-4">Top Events</h2>
              <Bars entries={data?.topEvents ?? []} />
            </div>
            <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
              <h2 className="font-bold mb-4">Top Referrers</h2>
              <Bars entries={data?.topReferrers ?? []} />
            </div>
            <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
              <h2 className="font-bold mb-4">Devices</h2>
              <Bars entries={data?.devices ?? []} />
            </div>
          </div>

          {data?.truncated && (
            <p className="text-xs text-gray-500 mt-6">
              Showing the most recent {RANGES.find((r) => r.days === days)?.label}{" "}
              of data (row cap reached).
            </p>
          )}
        </>
      )}
    </div>
  );
}
