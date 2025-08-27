import { Session, Driver, LapData, LocationData } from "@/lib/types";

// Use env if provided, else fallback to public OpenF1 API
const API_BASE =
  (process.env.NEXT_PUBLIC_OPENF1_API_URL || "https://api.openf1.org/v1").replace(/\/$/, "");


export const f1Api = {
  // Get sessions for a year
  getSessions: async (year: number): Promise<Session[]> => {
    const response = await fetch(`${API_BASE}/sessions?year=${year}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
  },

  // Get drivers for a session
  getDrivers: async (sessionKey: number): Promise<Driver[]> => {
    const response = await fetch(`${API_BASE}/drivers?session_key=${sessionKey}`);
    if (!response.ok) throw new Error('Failed to fetch drivers');
    return response.json();
  },

  // Get lap data
  getLaps: async (sessionKey: number, driverNumber?: number): Promise<LapData[]> => {
    const url = driverNumber 
      ? `${API_BASE}/laps?session_key=${sessionKey}&driver_number=${driverNumber}`
      : `${API_BASE}/laps?session_key=${sessionKey}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch laps');
    return response.json();
  },

  // Get location data for fastest lap
  getLocationData: async (
    sessionKey: number, 
    driverNumber: number, 
    startTime: string, 
    endTime: string
  ): Promise<LocationData[]> => {
    const response = await fetch(
      `${API_BASE}/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${encodeURIComponent(
        startTime
      )}&date<=${encodeURIComponent(endTime)}`
    );
    if (!response.ok) throw new Error('Failed to fetch location data');
    return response.json();
  }
,
  // Get car telemetry data for a given driver and time window
  getCarData: async (
    sessionKey: number,
    driverNumber: number,
    startTime: string,
    endTime: string
  ): Promise<any[]> => {
    // ✅ Operators unencoded in the key; only encode values
    const url =
      `${API_BASE}/car_data?session_key=${sessionKey}` +
      `&driver_number=${driverNumber}` +
      `&date>=${encodeURIComponent(startTime)}` +
      `&date<=${encodeURIComponent(endTime)}`;

    // eslint-disable-next-line no-console
    console.debug('openf1.getCarData fetching', url);
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch car data status=${res.status} body=${body}`);
  }

  // Diagnostic: fetch raw response text and status for car_data (no JSON parse)
  ,getCarDataRaw: async (
    sessionKey: number,
    driverNumber: number,
    startTime: string,
    endTime: string
  ) => {
    const dateGteKeyEncoded = encodeURIComponent("date>=");
    const dateLteKeyEncoded = encodeURIComponent("date<=");
    const encodedUrl = `${API_BASE}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}&${dateGteKeyEncoded}=${encodeURIComponent(
      startTime
    )}&${dateLteKeyEncoded}=${encodeURIComponent(endTime)}`;
    const rawUrl = `${API_BASE}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${encodeURIComponent(
      startTime
    )}&date<=${encodeURIComponent(endTime)}`;
    console.log(rawUrl) //i added just now

    const attempts: Array<{ url: string; status?: number; body?: string; error?: any }> = [];
    try {
      const r = await fetch(encodedUrl);
      const b = await r.text().catch(() => "");
      attempts.push({ url: encodedUrl, status: r.status, body: b });
      if (r.ok) return { ok: true, attempts };
    } catch (e) {
      attempts.push({ url: encodedUrl, error: String(e) });
    }

    try {
      const r2 = await fetch(rawUrl);
      const b2 = await r2.text().catch(() => "");
      attempts.push({ url: rawUrl, status: r2.status, body: b2 });
      if (r2.ok) return { ok: true, attempts };
    } catch (e) {
      attempts.push({ url: rawUrl, error: String(e) });
    }

    return { ok: false, attempts };
  }
};