// Weather for the greeting line. Open-Meteo: free, no key, no account.

const CODES = [
  [[0], 'Clear'], [[1], 'Mostly clear'], [[2], 'Partly cloudy'], [[3], 'Cloudy'], [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'], [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorms'],
]
const describe = (code) => CODES.find(([list]) => list.includes(code))?.[1] || ''

export async function geocode(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(10e3) })
  const hit = (await r.json()).results?.[0]
  if (!hit) throw new Error(`Couldn't find a place called "${name}"`)
  return { name: hit.name, country: hit.country_code || null, lat: hit.latitude, lon: hit.longitude }
}

export async function readWeather({ lat, lon, name, unit = 'c' }) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '1',
    current: 'temperature_2m,weather_code', daily: 'temperature_2m_max,temperature_2m_min',
    temperature_unit: unit === 'f' ? 'fahrenheit' : 'celsius',
  })
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(10e3) })
  if (!r.ok) throw new Error(`weather ${r.status}`)
  const d = await r.json()
  return {
    at: new Date().toISOString(), place: name,
    temp: Math.round(d.current.temperature_2m), sky: describe(d.current.weather_code),
    high: Math.round(d.daily.temperature_2m_max[0]), low: Math.round(d.daily.temperature_2m_min[0]),
  }
}
