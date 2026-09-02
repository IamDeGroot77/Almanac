import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Weather and daylight from Open-Meteo (free, no key). The place is chosen
// once in Settings by name or postcode and geocoded; the forecast is cached
// for an hour so the Today screen never waits on the network.

const CACHE_KEY = 'almanac:weather';
const CACHE_MS = 60 * 60 * 1000;

export async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

const CODES = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

export const describeCode = (code) => CODES[code] || '';

export async function fetchForecast({ lat, lon }, units = 'fahrenheit') {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset` +
    `&temperature_unit=${units}&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather failed (${res.status})`);
  const d = await res.json();
  const days = (d.daily?.time || []).map((date, i) => ({
    date,
    high: Math.round(d.daily.temperature_2m_max[i]),
    low: Math.round(d.daily.temperature_2m_min[i]),
    rain: d.daily.precipitation_probability_max?.[i] ?? null,
    code: d.daily.weather_code?.[i],
    sunrise: d.daily.sunrise?.[i],
    sunset: d.daily.sunset?.[i],
  }));
  return {
    fetchedAt: Date.now(),
    current: d.current ? { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code, isDay: !!d.current.is_day } : null,
    days,
  };
}

export function useWeather(place) {
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const key = place ? `${place.lat},${place.lon}` : null;

  const refresh = useCallback(
    async ({ force = false } = {}) => {
      if (!place || inFlight.current) return;
      inFlight.current = true;
      try {
        if (!force) {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached.key === key && Date.now() - cached.forecast.fetchedAt < CACHE_MS) {
              setForecast(cached.forecast);
              return;
            }
          }
        }
        const fresh = await fetchForecast(place);
        setForecast(fresh);
        setError(null);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ key, forecast: fresh }));
      } catch (err) {
        setError(err.message);
      } finally {
        inFlight.current = false;
      }
    },
    [key, place]
  );

  useEffect(() => {
    if (place) refresh();
    else setForecast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { forecast, error, refresh };
}
