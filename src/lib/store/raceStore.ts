import { create } from 'zustand';
import { Session, Driver, LapData } from '@/lib/types';

interface RaceState {
  selectedSession: Session | null;
  selectedDrivers: number[];
  lapData: Record<number, LapData[]>;
  isLoading: boolean;
  error: string | null;
  // shared animation state
  animationProgress: number; // 0..1
  isPlaying: boolean;
  // live car positions (world coords)
 // currentPositions: Record<number, { x: number; y: number; elapsed: number }>;
  
  setSelectedSession: (session: Session | null) => void;
  toggleDriver: (driverNumber: number) => void;
  setLapData: (driverNumber: number, data: LapData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnimationProgress: (p: number) => void;
  setIsPlaying: (v: boolean) => void;
  //setCurrentPositions: (positions: Record<number, { x: number; y: number; elapsed: number }>) => void;
  reset: () => void;
}

export const useRaceStore = create<RaceState>((set) => ({
  selectedSession: null,
  selectedDrivers: [],
  lapData: {},
  isLoading: false,
  error: null,
  animationProgress: 0,
  isPlaying: false,
  //currentPositions: {},
  
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
  setAnimationProgress: (p) => set({ animationProgress: Math.max(0, Math.min(1, p)) }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  //setCurrentPositions: (positions) => set({ currentPositions: positions }),
  reset: () => set({
    selectedSession: null,
    selectedDrivers: [],
    lapData: {},
    isLoading: false,
    error: null,
    animationProgress: 0,
    isPlaying: false,
    //currentPositions: {}
  })
}));