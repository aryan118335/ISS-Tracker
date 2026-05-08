import { useState, useEffect, useCallback } from 'react';

/**
 * useNews - fetches latest space news, caches it for 15 minutes, and provides
 * search, sorting and manual refresh capabilities.
 *
 * Returns an object:
 *   news        – array of article objects (already filtered/sorted)
 *   loading     – boolean indicating fetch in progress
 *   error       – error message string or null
 *   refresh     – function to force a re‑fetch (ignores cache)
 *   setSearch   – function to update search term
 *   setSort     – function to update sort option ('date' | 'source')
 *   sortOption  – current sort option
 */
export function useNews() {
  const CACHE_KEY = 'iss_news_cache';
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in ms

  const [rawNews, setRawNews] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortOption, setSort] = useState('date'); // 'date' or 'source'
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log('News API Key:', import.meta.env.VITE_NEWS_KEY ? 'Key exists' : 'Key missing');
    try {
      const response = await fetch(
        `https://newsdata.io/api/1/latest?apikey=${import.meta.env.VITE_NEWS_KEY}&language=en`
      );
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }
      const data = await response.json();
      const articles = data.results || [];
      const timestamp = Date.now();
      const payload = { articles, timestamp };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      setRawNews(articles);
    } catch (e) {
      setError(e.message || 'Failed to fetch news');
      setRawNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load – try cache first
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { articles, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setRawNews(articles);
          return;
        }
      } catch (_) {
        // fall‑through to fetch
      }
    }
    fetchNews();
  }, [fetchNews, refreshTrigger]);

  // Apply search & sort whenever raw data, search term or sort option changes
  useEffect(() => {
    let filtered = rawNews;
    if (search.trim()) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(
        (it) =>
          (it.title && it.title.toLowerCase().includes(lower)) ||
          (it.source_id && it.source_id.toLowerCase().includes(lower))
      );
    }
    if (sortOption === 'date') {
      filtered = filtered.slice().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    } else if (sortOption === 'source') {
      filtered = filtered.slice().sort((a, b) => {
        const sA = (a.source_id || '').toUpperCase();
        const sB = (b.source_id || '').toUpperCase();
        return sA.localeCompare(sB);
      });
    }
    setNews(filtered);
  }, [rawNews, search, sortOption]);

  const refresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setRefreshTrigger((c) => c + 1);
  }, []);

  return {
    news,
    loading,
    error,
    refresh,
    setSearch,
    setSort,
    sortOption,
  };
}
