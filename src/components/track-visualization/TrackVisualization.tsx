"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";

interface AnimationState {
  isPlaying: boolean;
  progress: number;
  speed: number;
}

export function TrackVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const { selectedSession, selectedDrivers } = useRaceStore();

  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    progress: 0,
    speed: 1,
  });

  // Query lap data for selected drivers
  const { data: allLapData, isLoading } = useQuery({
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

  // Query location data for fastest laps
  const { data: locationData } = useQuery({
    queryKey: [
      "locations",
      selectedSession?.session_key,
      selectedDrivers,
      allLapData,
    ],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0 || !allLapData)
        return {};

      const locationPromises = selectedDrivers.map(async (driverNumber) => {
        const laps = allLapData[driverNumber];
        if (!laps) return { driverNumber, locations: [] };

        try {
          const fastestLapInfo = calculateFastestLap(laps);
          const locations = await f1Api.getLocationData(
            selectedSession.session_key,
            driverNumber,
            fastestLapInfo.fastestLap.startTime,
            fastestLapInfo.fastestLap.endTime
          );

          return {
            driverNumber,
            locations: locations.map((loc) => ({
              ...loc,
              elapsed:
                (new Date(loc.date).getTime() -
                  new Date(locations[0].date).getTime()) /
                1000,
            })),
          };
        } catch (error) {
          console.error(
            `Failed to get location data for driver ${driverNumber}:`,
            error
          );
          return { driverNumber, locations: [] };
        }
      });

      const results = await Promise.all(locationPromises);
      return results.reduce((acc, { driverNumber, locations }) => {
        acc[driverNumber] = locations;
        return acc;
      }, {} as Record<number, any[]>);
    },
    enabled: !!(selectedSession && selectedDrivers.length > 0 && allLapData),
  });

  // Canvas setup and bounds calculation
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !locationData) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Calculate bounds from all location data
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    Object.values(locationData).forEach((locations: any[]) => {
      locations.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    if (!isFinite(minX)) return null;

    const bounds = { minX, minY, maxX, maxY };

    // Set canvas size and DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    return { ctx, bounds };
  };

  // World to canvas coordinate conversion
  const worldToCanvas = (x: number, y: number, bounds: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const padding = 40;

    const scaleX = (rect.width - 2 * padding) / (bounds.maxX - bounds.minX);
    const scaleY = (rect.height - 2 * padding) / (bounds.maxY - bounds.minY);
    const scale = Math.min(scaleX, scaleY);

    const canvasX = padding + (x - bounds.minX) * scale;
    const canvasY = padding + (y - bounds.minY) * scale;

    return [canvasX, canvasY];
  };

  // Draw track
  const drawTrack = (ctx: CanvasRenderingContext2D, bounds: any) => {
    if (!locationData || Object.keys(locationData).length === 0) return;

    // Use first driver's locations to draw track outline
    const firstDriverLocations = Object.values(locationData)[0] as any[];
    if (!firstDriverLocations || firstDriverLocations.length === 0) return;

    ctx.save();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw track background
    ctx.beginPath();
    firstDriverLocations.forEach((point, idx) => {
      const [x, y] = worldToCanvas(point.x, point.y, bounds);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw track surface
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 14;
    ctx.beginPath();
    firstDriverLocations.forEach((point, idx) => {
      const [x, y] = worldToCanvas(point.x, point.y, bounds);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw start/finish line
    const startPoint = firstDriverLocations[0];
    const [sx, sy] = worldToCanvas(startPoint.x, startPoint.y, bounds);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy - 12);
    ctx.lineTo(sx + 12, sy + 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  };

  // Draw cars
  const drawCars = (
    ctx: CanvasRenderingContext2D,
    bounds: any,
    progress: number
  ) => {
    if (!locationData) return;

    Object.entries(locationData).forEach(
      ([driverNumber, locations]: [string, any]) => {
        if (!locations || locations.length === 0) return;

        // Get driver info for color
        const driver = selectedDrivers.includes(parseInt(driverNumber))
          ? { team_colour: getDriverColor(parseInt(driverNumber)) }
          : null;

        if (!driver) return;

        // Calculate position based on progress
        const maxTime = Math.max(...locations.map((l: any) => l.elapsed));
        const targetTime = progress * maxTime;

        // Find interpolated position
        let position = locations[0];
        for (let i = 0; i < locations.length - 1; i++) {
          if (
            locations[i].elapsed <= targetTime &&
            locations[i + 1].elapsed >= targetTime
          ) {
            const t =
              (targetTime - locations[i].elapsed) /
              (locations[i + 1].elapsed - locations[i].elapsed);
            position = {
              x: locations[i].x + (locations[i + 1].x - locations[i].x) * t,
              y: locations[i].y + (locations[i + 1].y - locations[i].y) * t,
            };
            break;
          }
        }

        const [x, y] = worldToCanvas(position.x, position.y, bounds);

        ctx.save();
        ctx.fillStyle = `#${driver.team_colour}`;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    );
  };

  // Animation loop
  const animate = () => {
    if (!animationState.isPlaying) return;

    const setup = setupCanvas();
    if (!setup) return;

    const { ctx, bounds } = setup;

    // Clear canvas
    ctx.clearRect(
      0,
      0,
      ctx.canvas.width / window.devicePixelRatio,
      ctx.canvas.height / window.devicePixelRatio
    );

    // Draw track
    drawTrack(ctx, bounds);

    // Draw cars
    drawCars(ctx, bounds, animationState.progress);

    // Update progress
    setAnimationState((prev) => ({
      ...prev,
      progress: prev.progress >= 1 ? 0 : prev.progress + 0.01 * prev.speed,
    }));

    animationRef.current = requestAnimationFrame(animate);
  };

  // Start/stop animation
  useEffect(() => {
    if (animationState.isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationState.isPlaying, locationData]);

  // Static render when not animating
  useEffect(() => {
    if (!animationState.isPlaying) {
      const setup = setupCanvas();
      if (setup) {
        const { ctx, bounds } = setup;
        ctx.clearRect(
          0,
          0,
          ctx.canvas.width / window.devicePixelRatio,
          ctx.canvas.height / window.devicePixelRatio
        );
        drawTrack(ctx, bounds);
        drawCars(ctx, bounds, animationState.progress);
      }
    }
  }, [locationData, animationState.progress, animationState.isPlaying]);

  const getDriverColor = (driverNumber: number) => {
    // Fallback colors if we don't have driver data yet
    const colors = ["ED1131", "FF8000", "005AFF", "2D826D", "DC143C", "F58020"];
    return colors[driverNumber % colors.length];
  };

  const togglePlayPause = () => {
    setAnimationState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const resetAnimation = () => {
    setAnimationState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
  };

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
              disabled={isLoading}
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
              disabled={isLoading}
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
