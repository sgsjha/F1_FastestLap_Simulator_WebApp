"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";

interface AnimationState {
  isPlaying: boolean;
  progress: number;
  speed: number;
}

interface GPSPoint {
  date: string;
  x: number;
  y: number;
  z: number;
  elapsed: number;
}

interface ProcessedDriverData {
  driverNumber: number;
  acronym: string;
  name: string;
  team: string;
  color: string;
  locations: GPSPoint[];
  lapDuration: number;
}

interface TrackVisualizationProps {
  selectedSession?: {
    session_key: number;
    location: string;
    session_name: string;
  } | null;
  selectedDrivers?: number[];
  locationData?: Record<number, GPSPoint[]>;
  driverData?: Array<{
    driver_number: number;
    name_acronym: string;
    full_name: string;
    team_name: string;
    team_colour: string;
  }>;
  isLoading?: boolean;
}

export function TrackVisualization({}: TrackVisualizationProps) {
  // Source of truth: app store and queries
  const { selectedSession, selectedDrivers } = useRaceStore();

  const {
    data: driverData = [],
    isLoading: isDriversLoading,
    error: driversError,
  } = useQuery({
    queryKey: ["drivers", selectedSession?.session_key],
    queryFn: () =>
      selectedSession
        ? f1Api.getDrivers(selectedSession.session_key)
        : Promise.resolve([]),
    enabled: !!selectedSession,
  });

  const { data: allLapData = {}, isLoading: isLapsLoading } = useQuery({
    queryKey: ["laps", selectedSession?.session_key, selectedDrivers],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0)
        return {} as Record<number, any[]>;
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

  const { data: locationData = {}, isLoading: isLocationsLoading } = useQuery({
    queryKey: [
      "locations",
      selectedSession?.session_key,
      selectedDrivers,
      allLapData,
    ],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0)
        return {} as Record<number, GPSPoint[]>;
      const locPromises = selectedDrivers.map(async (driverNumber) => {
        const laps = (allLapData as Record<number, any[]>)[driverNumber];
        if (!laps || laps.length === 0)
          return { driverNumber, locations: [] as GPSPoint[] };
        try {
          const fastest = calculateFastestLap(laps);
          const points = await f1Api.getLocationData(
            selectedSession.session_key,
            driverNumber,
            fastest.fastestLap.startTime,
            fastest.fastestLap.endTime
          );
          const start = points[0]?.date
            ? new Date(points[0].date).getTime()
            : 0;
          const withElapsed: GPSPoint[] = points.map((p) => ({
            ...p,
            elapsed: start ? (new Date(p.date).getTime() - start) / 1000 : 0,
          }));
          return { driverNumber, locations: withElapsed };
        } catch (e) {
          console.error("location fetch failed", e);
          return { driverNumber, locations: [] as GPSPoint[] };
        }
      });
      const results = await Promise.all(locPromises);
      return results.reduce((acc, { driverNumber, locations }) => {
        acc[driverNumber] = locations;
        return acc;
      }, {} as Record<number, GPSPoint[]>);
    },
    enabled: !!(
      selectedSession &&
      selectedDrivers.length > 0 &&
      Object.keys(allLapData || {}).length > 0
    ),
  });

  const isLoading = isDriversLoading || isLapsLoading || isLocationsLoading;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    progress: 0,
    speed: 1,
  });

  // Process driver data
  const processedDrivers: ProcessedDriverData[] = selectedDrivers
    .map((driverNumber) => {
      const driver = driverData.find((d) => d.driver_number === driverNumber);
      const locations = locationData[driverNumber] || [];

      return {
        driverNumber,
        acronym: driver?.name_acronym || `#${driverNumber}`,
        name: driver?.full_name || `Driver ${driverNumber}`,
        team: driver?.team_name || "Unknown",
        color: driver?.team_colour || getDriverColor(driverNumber),
        locations,
        lapDuration:
          locations.length > 0 ? locations[locations.length - 1].elapsed : 0,
      };
    })
    .filter((d) => d.locations.length > 0);

  // Calculate track bounds
  const bounds = (() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    processedDrivers.forEach((driver) => {
      driver.locations.forEach((point) => {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      });
    });

    return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  })();

  // World to canvas coordinate conversion
  const worldToCanvas = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return [0, 0];

    const rect = canvas.getBoundingClientRect();
    const padding = 40;

    const scaleX = (rect.width - 2 * padding) / (bounds.maxX - bounds.minX);
    const scaleY = (rect.height - 2 * padding) / (bounds.maxY - bounds.minY);
    const scale = Math.min(scaleX, scaleY);

    const canvasX = padding + (x - bounds.minX) * scale;
    const canvasY = padding + (y - bounds.minY) * scale;

    return [canvasX, canvasY];
  };

  // Setup canvas
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const dpr = Math.min(
      2,
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    );
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return ctx;
  };

  // Draw track
  const drawTrack = (ctx: CanvasRenderingContext2D) => {
    if (processedDrivers.length === 0) return;

    // Use first driver's locations for track outline
    const trackPoints = processedDrivers[0].locations;

    ctx.save();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Track background
    ctx.beginPath();
    trackPoints.forEach((point, idx) => {
      const [x, y] = worldToCanvas(point.x, point.y);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Track surface
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 14;
    ctx.beginPath();
    trackPoints.forEach((point, idx) => {
      const [x, y] = worldToCanvas(point.x, point.y);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Start/finish line
    if (trackPoints.length > 0) {
      const [sx, sy] = worldToCanvas(trackPoints[0].x, trackPoints[0].y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(sx - 12, sy - 12);
      ctx.lineTo(sx + 12, sy + 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  // Get car position at progress
  const getCarPosition = (driver: ProcessedDriverData, progress: number) => {
    const { locations } = driver;
    if (locations.length === 0) return null;

    const maxTime = Math.max(...locations.map((l) => l.elapsed));
    const targetTime = progress * maxTime;

    // Find interpolated position
    for (let i = 0; i < locations.length - 1; i++) {
      if (
        locations[i].elapsed <= targetTime &&
        locations[i + 1].elapsed >= targetTime
      ) {
        const t =
          (targetTime - locations[i].elapsed) /
          (locations[i + 1].elapsed - locations[i].elapsed);
        return {
          x: locations[i].x + (locations[i + 1].x - locations[i].x) * t,
          y: locations[i].y + (locations[i + 1].y - locations[i].y) * t,
          elapsed: targetTime,
        };
      }
    }

    return locations[locations.length - 1];
  };

  // Draw cars
  const drawCars = (ctx: CanvasRenderingContext2D, progress: number) => {
    processedDrivers.forEach((driver, index) => {
      const position = getCarPosition(driver, progress);
      if (!position) return;

      const [x, y] = worldToCanvas(position.x, position.y);

      ctx.save();

      // Car body
      ctx.fillStyle = `#${driver.color}`;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Car outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Driver acronym
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#ffffffde";
      ctx.fillText(driver.acronym, x, y - 12);

      ctx.restore();
    });
  };

  // Draw trajectory lines
  const drawTrajectories = (
    ctx: CanvasRenderingContext2D,
    progress: number
  ) => {
    processedDrivers.forEach((driver) => {
      const maxTime = Math.max(...driver.locations.map((l) => l.elapsed));
      const currentTime = progress * maxTime;

      ctx.save();
      ctx.strokeStyle = `#${driver.color}66`; // Semi-transparent
      ctx.lineWidth = 2;
      ctx.beginPath();

      let hasStarted = false;
      driver.locations.forEach((point) => {
        if (point.elapsed <= currentTime) {
          const [x, y] = worldToCanvas(point.x, point.y);
          if (!hasStarted) {
            ctx.moveTo(x, y);
            hasStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });

      ctx.stroke();
      ctx.restore();
    });
  };

  // Main render function
  const render = () => {
    const ctx = setupCanvas();
    if (!ctx || !bounds) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Background grid
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < rect.width; i += 50) {
      ctx.fillRect(i, 0, 1, rect.height);
    }
    for (let j = 0; j < rect.height; j += 50) {
      ctx.fillRect(0, j, rect.width, 1);
    }
    ctx.restore();

    // Draw track
    drawTrack(ctx);

    // Draw trajectories
    drawTrajectories(ctx, animationState.progress);

    // Draw cars
    drawCars(ctx, animationState.progress);
  };

  // Animation loop
  const animate = (timestamp: number) => {
    if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
    const deltaTime =
      Math.min(0.05, (timestamp - lastTimestampRef.current) / 1000) *
      animationState.speed;
    lastTimestampRef.current = timestamp;

    if (animationState.isPlaying) {
      setAnimationState((prev) => ({
        ...prev,
        progress:
          prev.progress >= 1
            ? 0
            : Math.min(1, prev.progress + 0.01 * prev.speed),
      }));
    }

    render();
    animationRef.current = requestAnimationFrame(animate);
  };

  // Start/stop animation
  useEffect(() => {
    if (processedDrivers.length > 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [processedDrivers]);

  // Restart/stop loop on play state or speed change
  useEffect(() => {
    if (processedDrivers.length === 0) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationState.isPlaying, animationState.speed]);

  // Auto-start animation when drivers with GPS data become available
  useEffect(() => {
    if (processedDrivers.length > 0 && !animationState.isPlaying) {
      setAnimationState((prev) => ({ ...prev, isPlaying: true, progress: 0 }));
    }
  }, [processedDrivers.length]);

  // Render on data change
  useEffect(() => {
    render();
  }, [locationData, animationState.progress]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const togglePlayPause = () => {
    setAnimationState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const resetAnimation = () => {
    setAnimationState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
  };

  // Fallback colors
  function getDriverColor(driverNumber: number): string {
    const colors = ["ED1131", "FF8000", "005AFF", "2D826D", "DC143C", "F58020"];
    return colors[driverNumber % colors.length];
  }

  if (!selectedSession) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <CardContent>
          <div className="text-center">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground">
              Select a race session and drivers to view the track visualization.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedDrivers.length === 0) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <CardContent>
          <div className="text-center">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select Drivers</h3>
            <p className="text-muted-foreground">
              Choose drivers to compare on the track visualization.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Track Visualization
            <Badge variant="outline">
              {selectedSession.location} - {selectedSession.session_name}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlayPause}
              disabled={isLoading || processedDrivers.length === 0}
            >
              {animationState.isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetAnimation}
              disabled={isLoading || processedDrivers.length === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                Loading track data...
              </p>
            </div>
          </div>
        ) : processedDrivers.length === 0 ? (
          <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center">
              <p className="text-muted-foreground">
                No GPS data available for selected drivers
              </p>
            </div>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="w-full h-[500px] bg-zinc-900 rounded-lg border"
              style={{ imageRendering: "auto" }}
            />

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(animationState.progress * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[animationState.progress * 100]}
                    onValueChange={(value) =>
                      setAnimationState((prev) => ({
                        ...prev,
                        progress: value[0] / 100,
                      }))
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="w-32">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Speed</span>
                    <span className="text-xs text-muted-foreground">
                      {animationState.speed}x
                    </span>
                  </div>
                  <Slider
                    value={[animationState.speed]}
                    onValueChange={(value) =>
                      setAnimationState((prev) => ({
                        ...prev,
                        speed: value[0],
                      }))
                    }
                    min={0.1}
                    max={3}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>

              {processedDrivers.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {processedDrivers.map((driver) => (
                    <Badge
                      key={driver.driverNumber}
                      variant="outline"
                      className="text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: `#${driver.color}` }}
                      />
                      {driver.acronym}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
