import { create } from 'zustand';
import { Session, Driver, LapData } from '@/lib/types';

interface RaceState {
  selectedSession: Session | null;
  selectedDrivers: number[];
  lapData: Record<number, LapData[]>;
  isLoading: boolean;
  error: string | null;
  
  setSelectedSession: (session: Session | null) => void;
  toggleDriver: (driverNumber: number) => void;
  setLapData: (driverNumber: number, data: LapData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useRaceStore = create<RaceState>((set) => ({
  selectedSession: null,
  selectedDrivers: [],
  lapData: {},
  isLoading: false,
  error: null,
  
  setSelectedSession: (session) => set({ selectedSession: session }),
  toggleDriver: (driverNumber) => set((state) => ({
    selectedDrivers: state.selectedDrivers.includes(driverNumber)
      ? state.selectedDrivers.filter(d => d !== driverNumber)
      : [...state.selectedDrivers, driverNumber]
  })),
  setLapData: (driverNumber, data) => set((state) => ({
    lapData: { ...state.lapData, [driverNumber]: data }
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({
    selectedSession: null,
    selectedDrivers: [],
    lapData: {},
    isLoading: false,
    error: null
  })
}));