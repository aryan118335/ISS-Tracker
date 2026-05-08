import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { useISS } from './hooks/useISS';
import { useNews } from './hooks/useNews';
import ChatBot from './components/ChatBot';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

/* ─── ISS Custom Marker ──────────────────────────────────────── */
const ISS_ICON = L.divIcon({
  className: '',
  html: `<div class="iss-marker-wrapper">
           <div class="iss-marker-ring"></div>
           <div class="iss-marker-core"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/* ─── Map mover (keeps ISS centered) ────────────────────────── */
function MapController({ position, marker }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    if (marker.current) {
      marker.current.setLatLng([position.lat, position.lng]);
    } else {
      marker.current = L.marker([position.lat, position.lng], { icon: ISS_ICON })
        .addTo(map)
        .bindPopup(`ISS 🛸`);
    }
    map.panTo([position.lat, position.lng], { animate: true, duration: 1.2 });
  }, [position, map, marker]);

  return null;
}

/* ─── Speed Chart ────────────────────────────────────────────── */
function SpeedChart({ speedHistory, theme }) {
  const isDark = theme === 'dark';
  const gridColor  = isDark ? 'rgba(31,48,80,.7)'  : 'rgba(203,213,225,.6)';
  const textColor  = isDark ? '#8fa3be'             : '#64748b';
  const accentRgb  = isDark ? '59,130,246'          : '37,99,235';

  const data = {
    labels: speedHistory.map((d) => d.time),
    datasets: [{
      label: 'Speed (km/h)',
      data: speedHistory.map((d) => d.speed),
      borderColor: `rgb(${accentRgb})`,
      backgroundColor: `rgba(${accentRgb},.12)`,
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 10,
      fill: true,
      tension: 0.4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#141e30' : '#fff',
        titleColor: isDark ? '#e2e8f0' : '#0f172a',
        bodyColor: isDark ? '#8fa3be'  : '#475569',
        borderColor: isDark ? '#1f3050' : '#dde4ef',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} km/h`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 6 },
        grid: { color: gridColor },
        border: { color: gridColor },
      },
      y: {
        ticks: { color: textColor, font: { size: 10 } },
        grid: { color: gridColor },
        border: { color: gridColor },
      },
    },
  };

  return (
    <div style={{ height: 180 }}>
      <Line data={data} options={options} />
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────── */
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('iss-theme') || 'dark');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const markerRef = useRef(null);

  const { latest, positions, pathPositions, speedHistory, loading, lastUpdated, astronauts, refresh } = useISS(autoRefresh);

  // News hook
  const {
    news,
    loading: loadingNews,
    error: errorNews,
    refresh: refreshNews,
    setSearch,
    setSort,
    sortOption,
  } = useNews();


  /* Apply theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('iss-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const fmt = (val, dec = 4) =>
    val !== null && val !== undefined ? Number(val).toFixed(dec) : '—';

  const pathLatLngs = pathPositions.map((p) => [p.lat, p.lng]);

  return (
    <>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="iss-icon">🛸</div>
          <h1>ISS Tracker</h1>
          <span>MOCK DATA</span>
        </div>
        <div className="topbar-right">
          <button
            id="auto-refresh-btn"
            className={`btn btn-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh((v) => !v)}
            title="Toggle auto-refresh every 15s"
          >
            {autoRefresh ? '⏸ Auto' : '▶ Auto'}
          </button>
          <button
            id="refresh-btn"
            className="btn btn-primary"
            onClick={refresh}
            disabled={loading}
          >
            <span className={loading ? 'spinning' : ''}>↻</span>
            {loading ? 'Updating…' : 'Refresh Now'}
          </button>
          <button
            id="theme-btn"
            className="btn btn-icon"
            onClick={toggleTheme}
            title="Toggle dark/light mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ── Dashboard ── */}
      <main className="dashboard">

        {/* Status bar */}
        <div className="status-bar">
          <div className="status-dot" />
          <p>
            {lastUpdated
              ? <>Last updated: <strong>{lastUpdated.toLocaleTimeString()}</strong></>
              : 'Initializing…'}
          </p>
          {autoRefresh && <p style={{ color: 'var(--green)', fontSize: 12 }}>● Auto-refresh every 15s</p>}
        </div>

        {/* Stats cards */}
        <div className="stats-grid">
          <div className="stat-card accent">
            <div className="stat-icon accent">🌐</div>
            <div className="stat-label">Latitude</div>
            <div className={`stat-value ${loading && !latest ? 'loading' : ''}`}>
              {latest ? (
                <>{fmt(latest.position.lat, 4)}<small>°</small></>
              ) : null}
            </div>
            <div className="stat-sub">
              {latest ? (latest.position.lat >= 0 ? 'North' : 'South') : '—'}
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-icon purple">📍</div>
            <div className="stat-label">Longitude</div>
            <div className={`stat-value ${loading && !latest ? 'loading' : ''}`}>
              {latest ? (
                <>{fmt(latest.position.lng, 4)}<small>°</small></>
              ) : null}
            </div>
            <div className="stat-sub">
              {latest ? (latest.position.lng >= 0 ? 'East' : 'West') : '—'}
            </div>
          </div>

          <div className="stat-card amber">
            <div className="stat-icon amber">⚡</div>
            <div className="stat-label">Speed</div>
            <div className={`stat-value ${loading && !latest ? 'loading' : ''}`}>
              {latest ? (
                <>{latest.speed > 0 ? latest.speed.toLocaleString() : '—'}<small>km/h</small></>
              ) : null}
            </div>
            <div className="stat-sub">Haversine estimate</div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon green">👨‍🚀</div>
            <div className="stat-label">Astronauts</div>
            <div className="stat-value">
              {astronauts}<small>in space</small>
            </div>
            <div className="stat-sub">Live count from ISS</div>
          </div>
        </div>

        {/* Map + sidebar */}
        <div className="main-content">

          {/* ── Map panel ── */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="dot" />
                Live ISS Position
              </span>
              <span className="panel-badge">Leaflet Map</span>
            </div>
            <div className={`map-wrap ${theme === 'dark' ? 'dark-tiles' : ''}`}>
              <MapContainer
                center={[0, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
                id="iss-map"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                {pathLatLngs.length > 1 && (
                  <Polyline
                    positions={pathLatLngs}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 2.5,
                      opacity: 0.7,
                      dashArray: '6 4',
                    }}
                  />
                )}
                <MapController position={latest?.position} marker={markerRef} />
              </MapContainer>

              {/* Coords overlay */}
              {latest && (
                <div className="map-overlay-coords">
                  {fmt(latest.position.lat, 4)}°, {fmt(latest.position.lng, 4)}°
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="sidebar">

            {/* Nearest region */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title"><span className="dot" />Nearest Region</span>
              </div>
              <div className="nearest-panel">
                <div className="nearest-globe">{latest?.nearest?.emoji ?? '🌍'}</div>
                <div className="nearest-name">{latest?.nearest?.name ?? '—'}</div>
                <div className="nearest-sub">Based on current orbital position</div>
              </div>
            </div>

            {/* Speed chart */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title"><span className="dot" />Speed History</span>
                <span className="panel-badge">Last {speedHistory.length} readings</span>
              </div>
              <div className="chart-wrap">
                {speedHistory.length > 1
                  ? <SpeedChart speedHistory={speedHistory} theme={theme} />
                  : <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 0', fontSize: 13 }}>Collecting data…</p>
                }
              </div>
            </div>

            {/* Controls */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title"><span className="dot" />Controls</span>
              </div>
              <div className="controls-panel">
                <div className="controls-row">
                  <button
                    id="sidebar-refresh-btn"
                    className="btn btn-primary"
                    onClick={refresh}
                    disabled={loading}
                  >
                    <span className={loading ? 'spinning' : ''}>↻</span>
                    {loading ? 'Updating…' : 'Refresh Now'}
                  </button>
                </div>
                <div className="controls-row">
                  <button
                    id="sidebar-auto-btn"
                    className={`btn btn-toggle ${autoRefresh ? 'active' : ''}`}
                    onClick={() => setAutoRefresh((v) => !v)}
                  >
                    {autoRefresh ? '⏸ Pause Auto-Refresh' : '▶ Start Auto-Refresh (15s)'}
                  </button>
                </div>
                <div className="controls-row">
                  <button id="sidebar-theme-btn" className="btn btn-ghost" onClick={toggleTheme}>
                    {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                </div>
              </div>
            </div>

            {/* Position history list */}
            <div className="panel history-panel">
              <div className="panel-header">
                <span className="panel-title"><span className="dot" />Position Log</span>
                <span className="panel-badge">{positions.length} entries</span>
              </div>
              <div className="history-list">
                {[...positions].reverse().map((entry, i) => (
                  <div key={entry.timestamp} className="history-item">
                    <span className="history-idx">#{positions.length - i}</span>
                    <span className="history-coords">
                      {fmt(entry.position.lat, 2)}°, {fmt(entry.position.lng, 2)}°
                    </span>
                    <span className="history-speed">
                      {entry.speed > 0 ? `${entry.speed.toLocaleString()} km/h` : '—'}
                    </span>
                  </div>
                ))}
                {positions.length === 0 && (
                  <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                    Loading data…
                  </p>
                )}
              </div>
            </div>

          </div>{/* /sidebar */}
        </div>{/* /main-content */}

        {/* ── News Section ── */}
        <section className="news-section">
          <div className="news-header">
            <h2>Latest Space News</h2>
            <div className="news-controls">
              <input
                type="text"
                placeholder="Search title or source"
                onChange={(e) => setSearch(e.target.value)}
                className="news-search"
              />
              <select
                value={sortOption}
                onChange={(e) => setSort(e.target.value)}
                className="news-sort"
              >
                <option value="date">Sort by Date</option>
                <option value="source">Sort by Source</option>
              </select>
              <button className="btn btn-primary" onClick={refreshNews} disabled={loadingNews}>
                {loadingNews ? <span className="spinning">↻</span> : 'Refresh'}
              </button>
            </div>
          </div>
          {loadingNews && (
            <div className="news-loading">
              <div className="spinner" /> Loading news…
            </div>
          )}
          {errorNews && (
            <div className="news-error">
              <p>Error: {errorNews}</p>
              <button className="btn btn-primary" onClick={refreshNews}>Retry</button>
            </div>
          )}
          <div className="news-grid">
            {news.map((item) => (
              <div key={item.link} className="news-card">
                {item.image_url && (
                  <img src={item.image_url} alt={item.title} className="news-image" />
                )}
                <div className="news-content">
                  <h3 className="news-title">{item.title}</h3>
                  <p className="news-meta">
                    {item.source_id?.toUpperCase() ?? 'Unknown'} • {new Date(item.pubDate).toLocaleDateString()}
                  </p>
                  <p className="news-desc">{item.description}</p>
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Read More →</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── AI ChatBot ── */}
      <ChatBot issData={latest} newsData={news} astronauts={astronauts} />
    </>
  );
}
