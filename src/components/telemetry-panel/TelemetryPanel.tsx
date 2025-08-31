"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRaceStore } from "@/lib/store/raceStore";
import { f1Api } from "@/lib/api/openf1";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Timer } from "lucide-react";

// ...

interface TelemetryPanelProps {
  // Add these props to receive live data from TrackVisualization
  animationProgress?: number;
  locationData?: Record<number, any[]>;
  focusDriver?: number;
  isPlaying?: boolean;
}

const theme = {
  panel: "#0f0f12",
  text: "#e5e7eb",
  muted: "#a1a1aa",
  tileBg: "#111214",
  border: "#222",
  barBg: "#0b0b0e",
  green: "#22c55e",
  red: "#ef4444",
};

// Format seconds as mm:ss.sss (e.g., 1:23.456)
function formatTime(totalSeconds?: number): string {
  if (totalSeconds == null || !isFinite(totalSeconds) || totalSeconds < 0) {
    return "—";
  }
  const msTotal = Math.round(totalSeconds * 1000);
  const minutes = Math.floor(msTotal / 60000);
  const seconds = Math.floor((msTotal % 60000) / 1000);
  const ms = msTotal % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(
    3,
    "0"
  )}`;
}

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
    queryKey: ["drivers", selectedSession?.session_key],
    queryFn: () =>
      selectedSession
        ? f1Api.getDrivers(selectedSession.session_key)
        : Promise.resolve([]),
    enabled: !!selectedSession,
  });

  // Get lap data for telemetry calculations
  const { data: allLapData = {} } = useQuery({
    queryKey: ["laps", selectedSession?.session_key, selectedDrivers],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0) return {};
      const lapPromises = selectedDrivers.map(async (driverNumber) => {
        const laps = await f1Api.getLaps(
          selectedSession.session_key,
          driverNumber
        );
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

  // Session-wide fastest driver (across all drivers in the session)
  const { data: sessionFastest } = useQuery<{
    driverNumber: number;
    lapTime: number;
  } | null>({
    queryKey: ["session-fastest", selectedSession?.session_key],
    queryFn: async () => {
      if (!selectedSession) return null;
      const allDrivers = await f1Api.getDrivers(selectedSession.session_key);
      const lapResults = await Promise.all(
        allDrivers.map(async (d: any) => {
          try {
            const laps = await f1Api.getLaps(
              selectedSession.session_key,
              d.driver_number
            );
            if (!laps || laps.length === 0) return null;
            const f = calculateFastestLap(laps);
            return {
              driverNumber: d.driver_number,
              lapTime: f.fastestLap.lapTime,
            } as const;
          } catch {
            return null;
          }
        })
      );
      const valid = lapResults.filter(Boolean) as Array<{
        driverNumber: number;
        lapTime: number;
      }>;
      if (valid.length === 0) return null;
      valid.sort((a, b) => a.lapTime - b.lapTime);
      return valid[0];
    },
    enabled: !!selectedSession,
    staleTime: 60_000,
  });

  // Use focus driver or first selected driver
  const [localFocusDriver, setLocalFocusDriver] = useState<number | undefined>(
    undefined
  );
  const currentDriver = localFocusDriver ?? focusDriver ?? selectedDrivers[0];
  const driver = drivers.find((d) => d.driver_number === currentDriver);
  const driverLocations = locationData[currentDriver] || [];
  const driverLaps = allLapData[currentDriver] || [];

  // Determine fastest driver among selected (by fastest lap time)
  const fastestDriverNumber = useMemo(() => {
    try {
      const entries: Array<{ dn: number; lap: number }> = [];
      for (const dn of selectedDrivers || []) {
        const laps = (allLapData as any)?.[dn];
        if (laps && laps.length > 0) {
          const f = calculateFastestLap(laps);
          entries.push({ dn, lap: f.fastestLap.lapTime });
        }
      }
      if (entries.length === 0) return undefined;
      entries.sort((a, b) => a.lap - b.lap);
      return entries[0].dn;
    } catch {
      return undefined;
    }
  }, [allLapData, selectedDrivers]);

  // Get real car data for telemetry
  const [carDataDebug, setCarDataDebug] = useState<any>(null);
  const { data: carData = {} } = useQuery({
    queryKey: [
      "car-data",
      selectedSession?.session_key,
      selectedDrivers,
      allLapData,
    ],
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

            console.log(
              `Retrieved ${carDataPoints.length} car data points for driver ${driverNumber}:`,
              carDataPoints.slice(0, 3)
            );

            // If no points, fetch raw attempts for diagnostics
            if (
              (!carDataPoints || carDataPoints.length === 0) &&
              f1Api.getCarDataRaw
            ) {
              try {
                const raw = await f1Api.getCarDataRaw(
                  selectedSession.session_key,
                  driverNumber,
                  startTime,
                  endTime
                );
                // store debug info in a property we can show in the UI
                (results as any)[driverNumber] = [];
                (results as any)[`__debug_${driverNumber}`] = raw;
                console.warn("carData raw attempts", raw);
                return;
              } catch (err) {
                console.warn("failed to fetch raw car data attempts", err);
              }
            }

            // Add elapsed time to each point
            if (carDataPoints.length > 0) {
              const startTimestamp = new Date(carDataPoints[0].date).getTime();
              const processedData = carDataPoints.map((point) => ({
                ...point,
                elapsed:
                  (new Date(point.date).getTime() - startTimestamp) / 1000,
              }));
              results[driverNumber] = processedData;
            } else {
              results[driverNumber] = [];
            }
          } catch (error) {
            console.error(
              `Failed to fetch car data for driver ${driverNumber}:`,
              error
            );
            results[driverNumber] = [];
          }
        })
      );

      return results;
    },
    enabled: !!(
      selectedSession &&
      selectedDrivers.length > 0 &&
      Object.keys(allLapData).length > 0
    ),
  });

  // Calculate live telemetry from real car data
  const liveTelemetry = useMemo(() => {
    if (
      !currentDriver ||
      !carData[currentDriver] ||
      carData[currentDriver].length === 0
    ) {
      return {
        speed: 0,
        gear: "—",
        throttle: 0,
        brake: 0,
        drs: "OFF",
        elapsed: 0,
        position: "—",
        lapTime: "—",
        rpm: 0,
      };
    }

    const driverCarData = carData[currentDriver];
    const driverLocations = locationData[currentDriver] || [];

    // Prefer the official fastest lap time from lap timing as the authoritative duration
    let authoritativeLapSecs = 0;
    try {
      if (allLapData[currentDriver]?.length > 0) {
        const fastest = calculateFastestLap(allLapData[currentDriver]);
        authoritativeLapSecs = fastest.fastestLap.lapTime;
      }
    } catch {}

    // Fallbacks to sampled streams if timing not available
    if (!authoritativeLapSecs) {
      if (driverLocations.length > 0) {
        authoritativeLapSecs =
          driverLocations[driverLocations.length - 1]?.elapsed || 0;
      } else if (driverCarData.length > 0) {
        authoritativeLapSecs =
          driverCarData[driverCarData.length - 1]?.elapsed || 0;
      }
    }

    const lapDuration = authoritativeLapSecs; // for readability below
    // Determine master (slowest) lap time among selected drivers for the shared timeline
    let masterTimelineSecs = lapDuration;
    try {
      const times: number[] = [];
      for (const key of Object.keys(allLapData || {})) {
        const dn = Number(key);
        const laps = (allLapData as any)[dn];
        if (laps && laps.length > 0) {
          const f = calculateFastestLap(laps);
          times.push(f.fastestLap.lapTime);
        }
      }
      if (times.length > 0) masterTimelineSecs = Math.max(...times);
    } catch {}

    const EPS = 1e-4;
    const normProgress = Math.min(1, Math.max(0, progress));
    const snapProgress = normProgress >= 1 - EPS ? 1 : normProgress;
    // Elapsed along the shared timeline (slowest lap), clamped by this driver's lap duration
    const masterElapsed = snapProgress * (masterTimelineSecs || 0);
    const currentTime = Math.min(masterElapsed, lapDuration || 0);

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
        gear: "—",
        throttle: 0,
        brake: 0,
        drs: "OFF",
        elapsed: 0,
        position: "—",
        lapTime: "—",
        rpm: 0,
      };
    }

    // Get current position from location data
    let currentPosition = "—";
    if (driverLocations.length > 0) {
      // Find interpolated position
      for (let i = 0; i < driverLocations.length - 1; i++) {
        const loc1 = driverLocations[i];
        const loc2 = driverLocations[i + 1];
        if (loc1.elapsed <= currentTime && loc2.elapsed >= currentTime) {
          const t =
            (currentTime - loc1.elapsed) / (loc2.elapsed - loc1.elapsed);
          const x = loc1.x + (loc2.x - loc1.x) * t;
          const y = loc1.y + (loc2.y - loc1.y) * t;
          currentPosition = `${Math.round(x)},${Math.round(y)}`;
          break;
        }
      }
    }
    // Prefer precise world coords from the shared store if available
    /** const posEntry = (currentPositions as any)?.[currentDriver];
    if (posEntry && typeof posEntry.x === 'number' && typeof posEntry.y === 'number') {
      currentPosition = `${Math.round(posEntry.x)},${Math.round(posEntry.y)}`;
    }
     * 
     */

    // Get fastest lap time for reference
    let fastestLapTime = "—";
    if (allLapData[currentDriver]?.length > 0) {
      try {
        const fastest = calculateFastestLap(allLapData[currentDriver]);
        fastestLapTime = formatTime(fastest.fastestLap.lapTime);
      } catch (e) {
        // Handle error silently
      }
    }

    return {
      speed: closestPoint.speed || 0,
      gear: closestPoint.n_gear ? closestPoint.n_gear.toString() : "—",
      throttle: closestPoint.throttle || 0,
      brake: closestPoint.brake || 0,
      // DRS mapping per spec:
      // 0 or 1 => OFF; 10, 12, or 14 => ON; anything else defaults to OFF
      drs: [10, 12, 14].includes(Number(closestPoint.drs ?? 0)) ? "ON" : "OFF",
      elapsed: currentTime,
      position: currentPosition,
      lapTime: fastestLapTime,
      rpm: closestPoint.rpm || 0,
    };
  }, [progress, carData, locationData, allLapData, currentDriver]); // add currentPositions if want to show positions

  if (!selectedSession || selectedDrivers.length === 0) {
    return (
      <Card
        className="border rounded-xl overflow-hidden w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex flex-col"
        style={{
          background: theme.panel,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
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
    <Card
      className="border rounded-xl overflow-hidden w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex flex-col"
      style={{
        background: theme.panel,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      <CardContent className="p-2 sm:p-3 flex-1 overflow-y-auto">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <span
            className="inline-block h-[1.1rem] w-[1.1rem] rounded-full border-2"
            style={{
              background: `#${driver?.team_colour ?? "ED1131"}`,
              borderColor: `#${driver?.team_colour ?? "ED1131"}33`,
            }}
          />
          <div>
            <div className="font-bold tracking-wide flex items-center gap-1 text-sm sm:text-base">
              <span className="inline-flex items-center gap-1">
                <span>{driver?.name_acronym ?? "DRV"}</span>
                {currentDriver &&
                  sessionFastest?.driverNumber === currentDriver && (
                    <span title="Fastest lap in session">
                      <Timer
                        className="w-3.5 h-3.5 text-purple-400"
                        aria-label="Fastest overall"
                      />
                    </span>
                  )}
                {currentDriver && fastestDriverNumber === currentDriver && (
                  <Badge
                    variant="outline"
                    className="ml-1 border-purple-400/40 text-purple-300 bg-purple-500/10 text-[10px] px-1 py-0 leading-none h-4 rounded-sm whitespace-nowrap"
                  >
                    FS
                  </Badge>
                )}
              </span>
              <span>• {driver?.full_name?.split(" ")[0] ?? ""}</span>
            </div>
            <div className="text-xs sm:text-sm" style={{ color: theme.muted }}>
              {driver?.team_name ?? "Team"}
            </div>
          </div>
          <Badge
            variant="secondary"
            className="ml-auto font-bold text-xs sm:text-sm"
          >
            Q •{" "}
            {selectedSession?.date_start
              ? new Date(selectedSession.date_start).getUTCFullYear()
              : "—"}{" "}
            • HUN
          </Badge>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-1 sm:gap-2">
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              SPEED
            </div>
            <div className="leading-none font-extrabold text-[1.5rem] sm:text-[2.2rem] tabular-nums">
              {liveTelemetry.speed}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              km/h
            </div>
          </div>
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              GEAR
            </div>
            <div className="leading-none font-extrabold text-[1.5rem] sm:text-[2.2rem] tabular-nums">
              {liveTelemetry.gear}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              est.
            </div>
          </div>
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              RPM
            </div>
            <div className="leading-none font-extrabold text-[1.5rem] sm:text-[2.2rem] tabular-nums">
              {liveTelemetry.rpm}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              engine
            </div>
          </div>
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              ELAPSED
            </div>
            <div className="leading-none font-extrabold text-[1.3rem] sm:text-[2rem] tabular-nums">
              {formatTime(liveTelemetry.elapsed)}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              mm:ss.sss
            </div>
          </div>

          {/* Throttle bar */}
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3 col-span-2"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs mb-1 sm:mb-2"
              style={{ color: theme.muted }}
            >
              THROTTLE
            </div>
            <div
              className="h-[6px] sm:h-2 w-full rounded-full border overflow-hidden"
              style={{ background: theme.barBg, borderColor: theme.border }}
            >
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${liveTelemetry.throttle}%`,
                  background: theme.green,
                }}
              />
            </div>
          </div>

          {/* Brake bar */}
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3 col-span-2"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs mb-1 sm:mb-2"
              style={{ color: theme.muted }}
            >
              BRAKE
            </div>
            <div
              className="h-[6px] sm:h-2 w-full rounded-full border overflow-hidden"
              style={{ background: theme.barBg, borderColor: theme.border }}
            >
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${liveTelemetry.brake}%`,
                  background: theme.red,
                }}
              />
            </div>
          </div>

          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              DRS
            </div>
            <div
              className="leading-none font-extrabold text-[1.5rem] sm:text-[2.2rem]"
              style={{
                color: liveTelemetry.drs === "ON" ? theme.green : theme.text,
              }}
            >
              {liveTelemetry.drs}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              sector zones
            </div>
          </div>
          <div
            className="rounded-md sm:rounded-lg border p-2 sm:p-3"
            style={{ background: theme.tileBg, borderColor: theme.border }}
          >
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              LAP TIME
            </div>
            <div className="leading-none font-extrabold text-[1.3rem] sm:text-[2rem] tabular-nums">
              {liveTelemetry.lapTime}
            </div>
            <div
              className="text-[10px] sm:text-xs"
              style={{ color: theme.muted }}
            >
              target fastest
            </div>
          </div>
        </div>

        {/* Animation status indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${playing ? "animate-pulse" : ""}`}
            style={{ background: playing ? theme.green : theme.muted }}
          />
          <div className="text-xs" style={{ color: theme.muted }}>
            {playing ? "Live telemetry" : "Paused"} •{" "}
            {Math.round(progress * 100)}% complete
          </div>
        </div>
        {/* Driver focus buttons */}
        {selectedDrivers && selectedDrivers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedDrivers.map((dn) => {
              const d = drivers.find((x) => x.driver_number === dn);
              const teamColor = `#${d?.team_colour ?? "777"}`;
              const isActive = dn === currentDriver;
              const isFastestSelected = dn === fastestDriverNumber;
              const isSessionFastest = dn === sessionFastest?.driverNumber;
              return (
                <button
                  key={`focus-${dn}`}
                  type="button"
                  onClick={() => setLocalFocusDriver(dn)}
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                    isActive
                      ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900/60",
                  ].join(" ")}
                  aria-pressed={isActive}
                  title={`View ${d?.name_acronym ?? dn} telemetry`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full ring-2 ring-white/10"
                    style={{ background: teamColor }}
                  />
                  <span className="font-semibold inline-flex items-center gap-1">
                    {d?.name_acronym ?? dn}
                    {isSessionFastest && (
                      <span title="Fastest lap in session">
                        <Timer
                          className="w-3 h-3 text-purple-400"
                          aria-label="Fastest overall"
                        />
                      </span>
                    )}
                    {isFastestSelected && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-purple-400/40 text-purple-300 bg-purple-500/10 text-[10px] px-1 py-0 leading-none h-4 rounded-sm whitespace-nowrap"
                      >
                        FS
                      </Badge>
                    )}
                  </span>
                  {isActive ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {/* Debug: show raw car_data attempts if present */}
        <div className="mt-3">
          {(selectedDrivers || []).map((dn) => {
            const dbg = (carData as any)?.[`__debug_${dn}`];
            if (!dbg || !dbg.attempts) return null;
            return (
              <div
                key={`dbg-${dn}`}
                className="mt-2 text-xs"
                style={{ color: theme.muted }}
              >
                <div className="font-semibold">
                  Debug attempts for driver {dn}:
                </div>
                {dbg.attempts.map((a: any, i: number) => (
                  <pre
                    key={i}
                    className="mt-1 p-2 rounded"
                    style={{
                      background: "#071018",
                      color: "#ddd",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(
                      {
                        url: a.url,
                        status: a.status,
                        body:
                          typeof a.body === "string"
                            ? a.body.slice(0, 500)
                            : a.body,
                      },
                      null,
                      2
                    )}
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
