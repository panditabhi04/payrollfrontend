/**
 * Reverse Geocoding & 12-Hour Time Utilities
 * Provides human-readable street/area addresses from GPS coordinates
 * and formats 24h timestamps into clean 12h formats (e.g. 2:48 PM or 2:00 PM).
 */

const addressCache = new Map<string, string>();

/**
 * Convert 24-hour time or ISO timestamp into 12-hour format:
 * "14:48:32" -> "2:48 PM"
 * "02:00:00" -> "2:00 AM"
 * "14:00"    -> "2:00 PM"
 */
export function formatTime12h(timeStr?: string | null): string {
  if (!timeStr || timeStr === "-") return "-";
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return timeStr;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  return `${h}:${min} ${ampm}`;
}

/**
 * Reverse geocode latitude and longitude into readable address
 * using OpenStreetMap Nominatim with memory caching.
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (addressCache.has(key)) {
    return addressCache.get(key)!;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const parts = [
        addr.building || addr.amenity || addr.shop || addr.office,
        addr.road || addr.street || addr.pedestrian,
        addr.suburb || addr.neighbourhood || addr.residential,
        addr.city || addr.town || addr.village || addr.county,
        addr.state,
      ].filter(Boolean);

      const address = parts.length > 0
        ? parts.join(", ")
        : (data.display_name?.split(",").slice(0, 3).join(",") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

      addressCache.set(key, address);
      return address;
    }
  } catch {
    // Ignore network error and try secondary fallback provider
  }

  // 2. Secondary Fallback: BigDataCloud free client reverse geocode (no CORS / API key needed)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const bdcRes = await fetch(bdcUrl);
    if (bdcRes.ok) {
      const bdc = await bdcRes.json();
      const parts = [
        bdc.locality || bdc.neighbourhood,
        bdc.city || bdc.principalSubdivision,
        bdc.countryName,
      ].filter(Boolean);
      if (parts.length > 0) {
        const address = parts.join(", ");
        addressCache.set(key, address);
        return address;
      }
    }
  } catch {
    // Ignore and fallback to raw coordinates
  }

  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  addressCache.set(key, fallback);
  return fallback;
}
