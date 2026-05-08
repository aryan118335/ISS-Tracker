import { useState, useEffect, useCallback, useRef } from 'react';

/* ─── Haversine speed ──────────────────────────────────────── */
const R = 6371;
const toRad = (deg) => deg * (Math.PI / 180);

function calcSpeed(pos1, pos2, timeDiffSeconds) {
  if (!pos1 || timeDiffSeconds === 0) return 0;
  const dLat = toRad(pos2.lat - pos1.lat);
  const dLon = toRad(pos2.lng - pos1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(pos1.lat)) * Math.cos(toRad(pos2.lat)) *
    Math.sin(dLon / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (distance / timeDiffSeconds) * 3600; // km/h
}

/* ─── Nearest region lookup ────────────────────────────────── */
const LANDMARKS = [
  { name: 'Pacific Ocean',       emoji: '🌊', lat:   0, lng: -160 },
  { name: 'Atlantic Ocean',      emoji: '🌊', lat:  20, lng:  -30 },
  { name: 'Indian Ocean',        emoji: '🌊', lat: -10, lng:   70 },
  { name: 'North America',       emoji: '🌎', lat:  40, lng: -100 },
  { name: 'South America',       emoji: '🌎', lat: -15, lng:  -55 },
  { name: 'Europe',              emoji: '🌍', lat:  50, lng:   10 },
  { name: 'Africa',              emoji: '🌍', lat:   5, lng:   20 },
  { name: 'Asia',                emoji: '🌏', lat:  35, lng:  100 },
  { name: 'Australia',           emoji: '🌏', lat: -25, lng:  135 },
  { name: 'Antarctica',          emoji: '🧊', lat: -75, lng:    0 },
  { name: 'Arctic Ocean',        emoji: '🧊', lat:  80, lng:    0 },
  { name: 'Arabian Sea',         emoji: '🌊', lat:  15, lng:   65 },
  { name: 'Bay of Bengal',       emoji: '🌊', lat:  15, lng:   88 },
  { name: 'Gulf of Mexico',      emoji: '🌊', lat:  25, lng:  -90 },
  { name: 'Mediterranean Sea',   emoji: '🌊', lat:  36, lng:   18 },
  { name: 'South China Sea',     emoji: '🌊', lat:  12, lng:  114 },
  { name: 'Bering Sea',          emoji: '🌊', lat:  57, lng: -175 },
  { name: 'Caribbean Sea',       emoji: '🌊', lat:  16, lng:  -75 },
];

function getNearestPlace(lat, lng) {
  let nearest = LANDMARKS[0];
  let minDist = Infinity;
  for (const lm of LANDMARKS) {
    const d = Math.sqrt((lm.lat - lat) ** 2 + (lm.lng - lng) ** 2);
    if (d < minDist) { minDist = d; nearest = lm; }
  }
  return nearest;
}

/* ─── Mock ISS movement (orbital simulation) ───────────────── */
const MAX_HISTORY = 30;
const TRACK_PATH  = 15;
let _latPhase = Math.random() * Math.PI * 2;

function nextMockedPosition(prev) {
  _latPhase += 0.18;
  const newLat = 51.6 * Math.sin(_latPhase);
  const baseLng = prev ? prev.lng : -80.5;
  let newLng = baseLng + 22.9 + (Math.random() - 0.5) * 2;
  if (newLng > 180) newLng -= 360;
  return { lat: parseFloat(newLat.toFixed(4)), lng: parseFloat(newLng.toFixed(4)) };
}

/* ─── useISS hook ──────────────────────────────────────────── */
export function useISS(autoRefresh) {
  const [positions, setPositions] = useState([]);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [astronauts, setAstronauts] = useState(0);
  const prevTs = useRef(null);

  const fetchPosition = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch ISS Position
      const issRes = await fetch('http://api.open-notify.org/iss-now.json');
      const issData = await issRes.json();
      const newPos = {
        lat: parseFloat(issData.iss_position.latitude),
        lng: parseFloat(issData.iss_position.longitude)
      };

      // 2. Fetch Astronauts
      const astroRes = await fetch('http://api.open-notify.org/astros.json');
      const astroData = await astroRes.json();
      setAstronauts(astroData.number);

      // 3. Reverse Geocode (Nominatim)
      let locationName = 'Over ocean / remote area';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${newPos.lat}&lon=${newPos.lng}&format=json&accept-language=en`);
        const geoData = await geoRes.json();
        if (geoData && geoData.display_name) {
          locationName = geoData.display_name.split(',').slice(0, 3).join(',');
        }
      } catch (e) {
        console.error('Geocoding error:', e);
      }

      const now = Date.now();
      const timeDiff = prevTs.current ? (now - prevTs.current) / 1000 : 15;
      prevTs.current = now;

      setPositions((prev) => {
        const lastPos = prev.length > 0 ? prev[prev.length - 1].position : null;
        const speed = calcSpeed(lastPos, newPos, timeDiff);
        
        const entry = {
          position: newPos,
          speed: speed > 0 ? speed : (prev.length > 0 ? prev[prev.length - 1].speed : 27600),
          nearest: { name: locationName, emoji: '📍' },
          timestamp: now,
          timeLabel: new Date(now).toLocaleTimeString()
        };

        setSpeedHistory((sh) => [...sh, { speed: entry.speed, time: entry.timeLabel }].slice(-MAX_HISTORY));
        setLastUpdated(new Date(now));
        return [...prev, entry].slice(-MAX_HISTORY);
      });
    } catch (error) {
      console.error('ISS fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosition(); }, [fetchPosition]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchPosition, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchPosition]);

  const latest = positions[positions.length - 1] || null;
  const pathPositions = positions.slice(-TRACK_PATH).map((p) => p.position);
  return { latest, positions, pathPositions, speedHistory, loading, lastUpdated, astronauts, refresh: fetchPosition };
}
