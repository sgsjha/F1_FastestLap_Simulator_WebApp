"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRaceStore } from "@/lib/store/raceStore";
import { f1Api } from "@/lib/api/openf1";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ...

interface TelemetryPanelProps {
  // Add these props to receive live data from TrackVisualization
  animationProgress?: number;
  locationData?: Record<number, any[]>;
  focusDriver?: number;
  isPlaying?: boolean;
}

const theme = {
  panel: '#0f0f12',
  text: '#e5e7eb',
  muted: '#a1a1aa',
  tileBg: '#111214',
  border: '#222',
  barBg: '#0b0b0e',
  green: '#22c55e',
  red: '#ef4444',
};

export default function TelemetryPanel({
  animationProgress,
  locationData = {},
  focusDriver,
  isPlaying,
}: TelemetryPanelProps) {
  const {
    selectedSession,
    selectedDrivers,
    animationProgress: storeProgress,
    isPlaying: storeIsPlaying,
  //currentPositions,
  } = useRaceStore();
  const progress = animationProgress ?? storeProgress ?? 0;
  const playing = isPlaying ?? storeIsPlaying ?? false;

  // Get driver data
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers', selectedSession?.session_key],
    queryFn: () =>
      selectedSession
        ? f1Api.getDrivers(selectedSession.session_key)
        : Promise.resolve([]),
    enabled: !!selectedSession,
  });

  // Get lap data for telemetry calculations
  const { data: allLapData = {} } = useQuery({
    queryKey: ['laps', selectedSession?.session_key, selectedDrivers],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0) return {};
      const lapPromises = selectedDrivers.map(async (driverNumber) => {
        const laps = await f1Api.getLaps(selectedSession.session_key, driverNumber);
        return { driverNumber, laps };
      });
      const results = await Promise.all(lapPromises);
      return results.reduce((acc, { driverNumber, laps }) => {
        acc[driverNumber] = laps;
        return acc;
      }, {} as Record<number, any[]>);
    },
    enabled: !!(selectedSession && selectedDrivers.length > 0),
  });

  // Use focus driver or first selected driver
  const currentDriver = focusDriver || selectedDrivers[0];
  const driver = drivers.find(d => d.driver_number === currentDriver);
  const driverLocations = locationData[currentDriver] || [];
  const driverLaps = allLapData[currentDriver] || [];

  // Get real car data for telemetry
  const [carDataDebug, setCarDataDebug] = useState<any>(null);
  const { data: carData = {} } = useQuery({
    queryKey: ['car-data', selectedSession?.session_key, selectedDrivers, allLapData],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0) return {};
      
      const results: Record<number, any[]> = {};
      
      await Promise.all(
        selectedDrivers.map(async (driverNumber) => {
          try {
            const laps = allLapData[driverNumber];
            if (!laps || laps.length === 0) {
              results[driverNumber] = [];
              return;
            }
            
            const fastestLapInfo = calculateFastestLap(laps);
            const startTime = fastestLapInfo.fastestLap.startTime;
            const endTime = fastestLapInfo.fastestLap.endTime;
            
            console.log(`Fetching car data for driver ${driverNumber}:`);
            console.log(`Session: ${selectedSession.session_key}`);
            console.log(`Start time: ${startTime}`);
            console.log(`End time: ${endTime}`);
            console.log(`Lap duration: ${fastestLapInfo.fastestLap.lapTime}s`);
            
            const carDataPoints = await f1Api.getCarData(
              selectedSession.session_key,
              driverNumber,
              startTime,
              endTime
            );

            console.log(`Retrieved ${carDataPoints.length} car data points for driver ${driverNumber}:`, carDataPoints.slice(0, 3));

            // If no points, fetch raw attempts for diagnostics
            if ((!carDataPoints || carDataPoints.length === 0) && f1Api.getCarDataRaw) {
              try {
                const raw = await f1Api.getCarDataRaw(selectedSession.session_key, driverNumber, startTime, endTime);
                // store debug info in a property we can show in the UI
                (results as any)[driverNumber] = [];
                (results as any)[`__debug_${driverNumber}`] = raw;
                console.warn('carData raw attempts', raw);
                return;
              } catch (err) {
                console.warn('failed to fetch raw car data attempts', err);
              }
            }
            
            // Add elapsed time to each point
            if (carDataPoints.length > 0) {
              const startTimestamp = new Date(carDataPoints[0].date).getTime();
              const processedData = carDataPoints.map(point => ({
                ...point,
                elapsed: (new Date(point.date).getTime() - startTimestamp) / 1000
              }));
              results[driverNumber] = processedData;
            } else {
              results[driverNumber] = [];
            }
            
          } catch (error) {
            console.error(`Failed to fetch car data for driver ${driverNumber}:`, error);
            results[driverNumber] = [];
          }
        })
      );
      
      return results;
    },
    enabled: !!(selectedSession && selectedDrivers.length > 0 && Object.keys(allLapData).length > 0),
  });

  // Calculate live telemetry from real car data
  const liveTelemetry = useMemo(() => {
    if (!currentDriver || !carData[currentDriver] || carData[currentDriver].length === 0) {
      return {
        speed: 0,
        gear: '—',
        throttle: 0,
        brake: 0,
        drs: 'OFF',
        elapsed: 0,
        position: '—',
        lapTime: '—',
        rpm: 0
      };
    }

    const driverCarData = carData[currentDriver];
    const driverLocations = locationData[currentDriver] || [];
    
    // Get lap duration
    const lapDuration = driverLocations.length > 0 
      ? driverLocations[driverLocations.length - 1]?.elapsed || 0 
      : driverCarData[driverCarData.length - 1]?.elapsed || 0;
    
  const currentTime = progress * lapDuration;

    // Find the closest car data point to current time
    let closestPoint = driverCarData[0];
    let minTimeDiff = Math.abs(closestPoint?.elapsed - currentTime) || Infinity;

    for (const point of driverCarData) {
      const timeDiff = Math.abs(point.elapsed - currentTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPoint = point;
      }
    }

    if (!closestPoint) {
      return {
        speed: 0,
        gear: '—',
        throttle: 0,
        brake: 0,
        drs: 'OFF',
        elapsed: 0,
        position: '—',
        lapTime: '—',
        rpm: 0
      };
    }

    // Get current position from location data
  let currentPosition = '—';
    if (driverLocations.length > 0) {
      // Find interpolated position
      for (let i = 0; i < driverLocations.length - 1; i++) {
        const loc1 = driverLocations[i];
        const loc2 = driverLocations[i + 1];
        if (loc1.elapsed <= currentTime && loc2.elapsed >= currentTime) {
          const t = (currentTime - loc1.elapsed) / (loc2.elapsed - loc1.elapsed);
          const x = loc1.x + (loc2.x - loc1.x) * t;
          const y = loc1.y + (loc2.y - loc1.y) * t;
          currentPosition = `${Math.round(x)},${Math.round(y)}`;
          break;
        }
      }
    }
    /**
     *     // Prefer precise world coords from the shared store if available
    const posEntry = (currentPositions as any)?.[currentDriver];
    if (posEntry && typeof posEntry.x === 'number' && typeof posEntry.y === 'number') {
      currentPosition = `${Math.round(posEntry.x)},${Math.round(posEntry.y)}`;
    }

     */

    // Get fastest lap time for reference
    let fastestLapTime = '—';
    if (allLapData[currentDriver]?.length > 0) {
      try {
        const fastest = calculateFastestLap(allLapData[currentDriver]);
        fastestLapTime = fastest.fastestLap.lapTime.toFixed(3);
      } catch (e) {
        // Handle error silently
      }
    }

    return {
      speed: closestPoint.speed || 0,
      gear: closestPoint.n_gear ? closestPoint.n_gear.toString() : '—',
      throttle: closestPoint.throttle || 0,
      brake: closestPoint.brake || 0,
      drs: closestPoint.drs ? (closestPoint.drs > 0 ? 'ON' : 'OFF') : 'OFF',
      elapsed: currentTime,
      position: currentPosition,
      lapTime: fastestLapTime,
      rpm: closestPoint.rpm || 0
    };
  }, [progress, carData, locationData, allLapData, currentDriver]); // add currentPositions if want to show positions

  if (!selectedSession || selectedDrivers.length === 0) {
    return (
      <Card className="border rounded-xl overflow-hidden" style={{ background: theme.panel, borderColor: theme.border, color: theme.text }}>
        <CardContent className="p-3">
          <div className="text-center py-8">
            <div className="text-sm" style={{ color: theme.muted }}>
              Select a session and drivers to view telemetry
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border rounded-xl overflow-hidden" style={{ background: theme.panel, borderColor: theme.border, color: theme.text }}>
      <CardContent className="p-3">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block h-[1.1rem] w-[1.1rem] rounded-full border-2"
            style={{
              background: `#${driver?.team_colour ?? 'ED1131'}`,
              borderColor: `#${driver?.team_colour ?? 'ED1131'}33`,
            }}
          />
          <div>
            <div className="font-bold tracking-wide">
              {driver?.name_acronym ?? 'DRV'} • {driver?.full_name?.split(' ')[0] ?? ''}
            </div>
            <div className="text-sm" style={{ color: theme.muted }}>
              {driver?.team_name ?? 'Team'}
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto font-bold">
            Q • {selectedSession?.date_start ? new Date(selectedSession.date_start).getUTCFullYear() : '—'} • HUN
          </Badge>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>SPEED</div>
            <div className="leading-none font-extrabold text-[2.2rem] tabular-nums">{liveTelemetry.speed}</div>
            <div className="text-xs" style={{ color: theme.muted }}>km/h</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>GEAR</div>
            <div className="leading-none font-extrabold text-[2.2rem] tabular-nums">{liveTelemetry.gear}</div>
            <div className="text-xs" style={{ color: theme.muted }}>est.</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>RPM</div>
            <div className="leading-none font-extrabold text-[2.2rem] tabular-nums">{liveTelemetry.rpm}</div>
            <div className="text-xs" style={{ color: theme.muted }}>engine</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>ELAPSED</div>
            <div className="leading-none font-extrabold text-[2.2rem] tabular-nums">{liveTelemetry.elapsed.toFixed(3)}</div>
            <div className="text-xs" style={{ color: theme.muted }}>seconds</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>POSITION</div>
            <div className="leading-none font-extrabold text-lg">{liveTelemetry.position}</div>
            <div className="text-xs" style={{ color: theme.muted }}>X,Y coords</div>
          </div>

          {/* Throttle bar */}
          <div className="rounded-lg border p-3 col-span-2" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs mb-2" style={{ color: theme.muted }}>THROTTLE</div>
            <div className="h-2 w-full rounded-full border overflow-hidden" style={{ background: theme.barBg, borderColor: theme.border }}>
              <div 
                className="h-full transition-all duration-100" 
                style={{ width: `${liveTelemetry.throttle}%`, background: theme.green }} 
              />
            </div>
          </div>

          {/* Brake bar */}
          <div className="rounded-lg border p-3 col-span-2" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs mb-2" style={{ color: theme.muted }}>BRAKE</div>
            <div className="h-2 w-full rounded-full border overflow-hidden" style={{ background: theme.barBg, borderColor: theme.border }}>
              <div 
                className="h-full transition-all duration-100" 
                style={{ width: `${liveTelemetry.brake}%`, background: theme.red }} 
              />
            </div>
          </div>

          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>DRS</div>
            <div 
              className="leading-none font-extrabold text-[2.2rem]"
              style={{ color: liveTelemetry.drs === 'ON' ? theme.green : theme.text }}
            >
              {liveTelemetry.drs}
            </div>
            <div className="text-xs" style={{ color: theme.muted }}>sector zones</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: theme.tileBg, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>LAP TIME</div>
            <div className="leading-none font-extrabold text-[2.2rem] tabular-nums">{liveTelemetry.lapTime}</div>
            <div className="text-xs" style={{ color: theme.muted }}>target fastest</div>
          </div>
        </div>

        {/* Animation status indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div 
            className={`w-2 h-2 rounded-full ${playing ? 'animate-pulse' : ''}`}
            style={{ background: playing ? theme.green : theme.muted }}
          />
            <div className="text-xs" style={{ color: theme.muted }}>
              {playing ? "Live telemetry" : "Paused"} • {Math.round(progress * 100)}% complete
            </div>
        </div>
        {/* Debug: show raw car_data attempts if present */}
        <div className="mt-3">
          {(selectedDrivers || []).map((dn) => {
            const dbg = (carData as any)?.[`__debug_${dn}`];
            if (!dbg || !dbg.attempts) return null;
            return (
              <div key={`dbg-${dn}`} className="mt-2 text-xs" style={{ color: theme.muted }}>
                <div className="font-semibold">Debug attempts for driver {dn}:</div>
                {dbg.attempts.map((a: any, i: number) => (
                  <pre key={i} className="mt-1 p-2 rounded" style={{ background: '#071018', color: '#ddd', overflowX: 'auto' }}>
{JSON.stringify({ url: a.url, status: a.status, body: typeof a.body === 'string' ? a.body.slice(0, 500) : a.body }, null, 2)}
                  </pre>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}