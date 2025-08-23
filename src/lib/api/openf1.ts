import { Session, Driver, LapData, LocationData } from "@/lib/types";


const API_BASE = process.env.NEXT_PUBLIC_OPENF1_API_URL;


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
      `${API_BASE}/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${startTime}&date<=${endTime}`
    );
    if (!response.ok) throw new Error('Failed to fetch location data');
    return response.json();
  }
};