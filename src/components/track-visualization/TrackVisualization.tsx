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
  lapDuration: number; // seconds
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
  const { selectedSession, selectedDrivers } = useRaceStore();

  // CAMERA (zoom + pan)
  const cameraRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 6;

  const { data: driverData = [], isLoading: isDriversLoading } = useQuery({
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

  const { data: locationData = {}, isLoading: isLocationsLoading } = useQuery<
    Record<number, GPSPoint[]>
  >({
    queryKey: [
      "locations",
      selectedSession?.session_key,
      selectedDrivers,
      allLapData,
    ],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0)
        return {} as Record<number, GPSPoint[]>;

      // Compute each driver's fastest lap info from provided laps
      const perDriverFastest = selectedDrivers
        .map((driverNumber) => {
          const laps = (allLapData as Record<number, any[]>)[driverNumber];
          if (!laps || laps.length === 0)
            return { driverNumber, error: true } as const;
          try {
            const fastest = calculateFastestLap(laps);
            return { driverNumber, fastest: fastest.fastestLap } as const;
          } catch (e) {
            return { driverNumber, error: true } as const;
          }
        })
        .filter((d) => !("error" in d)) as Array<{
        driverNumber: number;
        fastest: { lapTime: number; startTime: string; endTime: string };
      }>;

      if (perDriverFastest.length === 0)
        return {} as Record<number, GPSPoint[]>;

      // Find the overall fastest lap across selected drivers
      perDriverFastest.sort((a, b) => a.fastest.lapTime - b.fastest.lapTime);
      const fastestDriverEntry = perDriverFastest[0];
      const fastestDriverNumber = fastestDriverEntry.driverNumber;

      // Fetch location points once for the overall fastest driver's fastest lap
      let fastestPoints: GPSPoint[] = [];
      try {
        const pts = await f1Api.getLocationData(
          selectedSession.session_key,
          fastestDriverNumber,
          fastestDriverEntry.fastest.startTime,
          fastestDriverEntry.fastest.endTime
        );
        const start = pts[0]?.date ? new Date(pts[0].date).getTime() : 0;
        fastestPoints = pts.map((p) => ({
          ...p,
          elapsed: start ? (new Date(p.date).getTime() - start) / 1000 : 0,
        }));
      } catch (e) {
        console.error("location fetch failed for fastest driver", e);
        // return empty mappings
        return selectedDrivers.reduce((acc, dn) => {
          acc[dn] = [] as GPSPoint[];
          return acc;
        }, {} as Record<number, GPSPoint[]>);
      }

      // Keep the fastestPoints as the canonical spatial path (elapsed is relative to the fastest lap)
      const fastestMaxElapsed =
        fastestPoints.length > 0
          ? Math.max(...fastestPoints.map((p) => p.elapsed))
          : 0;

      // Set the master lap time (seconds) to the slowest lap time among selected drivers
      // so the timeline runs until the slowest driver completes their lap. Fastest
      // drivers will reach their end earlier and remain at the finish line.
      const slowestLapTime = Math.max(
        ...perDriverFastest.map((d) => d.fastest.lapTime)
      );
      masterLapTimeRef.current = slowestLapTime;

      // For each driver, return the same spatial points (no per-point scaling).
      // We'll use each driver's lapDuration for pacing when rendering.
      const result = selectedDrivers.reduce((acc, driverNumber) => {
        const entry = perDriverFastest.find(
          (d) => d.driverNumber === driverNumber
        );
        if (!entry) {
          acc[driverNumber] = [];
          return acc;
        }
        acc[driverNumber] = fastestPoints;
        return acc;
      }, {} as Record<number, GPSPoint[]>);

      return result as Record<number, GPSPoint[]>;
    },
    enabled: !!(
      selectedSession &&
      selectedDrivers.length > 0 &&
      Object.keys(allLapData || {}).length > 0
    ),
  });

  const isLoading = isDriversLoading || isLapsLoading || isLocationsLoading;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  //const currentPositionsRef = useRef<Record<number, { x: number; y: number; elapsed: number }>>({});
  const animationRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  // master (fastest) lap time in seconds — used as the canonical timeline
  const masterLapTimeRef = useRef<number | null>(null);

  const [animationState, setAnimationState] = useState<AnimationState>({
    isPlaying: false,
    progress: 0,
    speed: 1,
  });
  const { setAnimationProgress, setIsPlaying } = useRaceStore();

  // Process driver data
  const processedDrivers: ProcessedDriverData[] = selectedDrivers
    .map((driverNumber) => {
      const driver = driverData.find((d) => d.driver_number === driverNumber);
      const locations =
        (locationData as Record<number, GPSPoint[]>)[driverNumber] || [];
      // determine lapDuration (seconds) from provided lap data if available
      let lapDuration = 0;
      try {
        const laps = (allLapData as Record<number, any[]>)[driverNumber];
        if (laps && laps.length > 0) {
          const fastest = calculateFastestLap(laps);
          lapDuration = fastest.fastestLap.lapTime;
        } else if (locations.length > 0) {
          // fallback: use elapsed of last point (this will match fastest lap if no lap data)
          lapDuration = locations[locations.length - 1].elapsed || 0;
        }
      } catch (e) {
        lapDuration =
          locations.length > 0
            ? locations[locations.length - 1].elapsed || 0
            : 0;
      }

      return {
        driverNumber,
        acronym: driver?.name_acronym || `#${driverNumber}`,
        name: driver?.full_name || `Driver ${driverNumber}`,
        team: driver?.team_name || "Unknown",
        color: driver?.team_colour || getDriverColor(driverNumber),
        locations,
        lapDuration,
      };
    })
    .filter((d) => d.locations.length > 0);

  // Bounds from GPS points
  const bounds = (() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    processedDrivers.forEach((driver) => {
      driver.locations.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });
    return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  })();

  // World → Canvas (with zoom/pan)
  const worldToCanvas = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return [0, 0];

    const rect = canvas.getBoundingClientRect();
    const padding = 40;

    // base mapping (fit to canvas)
    const scaleX = (rect.width - 2 * padding) / (bounds.maxX - bounds.minX);
    const scaleY = (rect.height - 2 * padding) / (bounds.maxY - bounds.minY);
    const baseScale = Math.min(scaleX, scaleY);

    const baseX = padding + (x - bounds.minX) * baseScale;
    const baseY = padding + (y - bounds.minY) * baseScale;

    // camera transform around canvas center
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const { zoom, panX, panY } = cameraRef.current;

    const zx = (baseX - cx) * zoom + cx + panX;
    const zy = (baseY - cy) * zoom + cy + panY;

    return [zx, zy];
  };

  // Canvas setup
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

  // Draw track (zoom-scaled thickness)
  const drawTrack = (ctx: CanvasRenderingContext2D) => {
    if (processedDrivers.length === 0) return;
    const trackPoints = processedDrivers[0].locations;
    const z = cameraRef.current.zoom;

    // helpers to clamp widths
    const bgWidth = Math.max(6, Math.min(40, 20 * z)); // was 20
    const fgWidth = Math.max(4, Math.min(30, 14 * z)); // was 14
    const sfWidth = Math.max(2, Math.min(6, 3 * z)); // was 3
    const dashLen = 8 * Math.max(0.6, Math.min(1.8, z)); // scale dash a bit

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Track background
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = bgWidth;
    ctx.beginPath();
    trackPoints.forEach((p, i) => {
      const [x, y] = worldToCanvas(p.x, p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Track surface
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = fgWidth;
    ctx.beginPath();
    trackPoints.forEach((p, i) => {
      const [x, y] = worldToCanvas(p.x, p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Start/finish
    if (trackPoints.length > 0) {
      const [sx, sy] = worldToCanvas(trackPoints[0].x, trackPoints[0].y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = sfWidth;
      ctx.setLineDash([dashLen, dashLen]);
      ctx.beginPath();
      ctx.moveTo(sx - 12, sy - 12);
      ctx.lineTo(sx + 12, sy + 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  // Interpolate position at progress
  const getCarPosition = (driver: ProcessedDriverData, progress: number) => {
    const { locations, lapDuration } = driver;
    if (locations.length === 0) return null;

    // master lap time (seconds)
    const masterLap =
      masterLapTimeRef.current ?? Math.max(...locations.map((l) => l.elapsed));
    // elapsed time along master timeline
    const masterElapsed = progress * masterLap;

    // driver progress fraction (0..1) relative to their own lap duration
    const driverFrac =
      lapDuration > 0
        ? Math.min(1, masterElapsed / lapDuration)
        : Math.min(1, progress);

    // map driverFrac back to fastestPoints elapsed (which are based on fastest lap)
    const fastestMax = Math.max(...locations.map((l) => l.elapsed));
    const targetTime = driverFrac * fastestMax;

    for (let i = 0; i < locations.length - 1; i++) {
      const a = locations[i];
      const b = locations[i + 1];
      if (a.elapsed <= targetTime && b.elapsed >= targetTime) {
        const t = (targetTime - a.elapsed) / (b.elapsed - a.elapsed || 1);
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          elapsed: targetTime,
        };
      }
    }
    return locations[locations.length - 1];
  };

  // Draw cars (zoom-scaled size & outline)
  const drawCars = (ctx: CanvasRenderingContext2D, progress: number) => {
    const z = cameraRef.current.zoom;
    const radius = Math.max(4, Math.min(16, 8 * z)); // was 8
    const outline = Math.max(1, Math.min(3, 2 * z)); // was 2
    const labelSize = Math.round(
      Math.max(10, Math.min(16, 12 * (0.9 + 0.2 * z)))
    );
    const labelOffset = Math.max(10, Math.min(18, 12 * (0.9 + 0.2 * z)));

    //const posMap: Record<number, { x: number; y: number; elapsed: number }> = {};
    processedDrivers.forEach((driver) => {
      const pos = getCarPosition(driver, progress);
      if (!pos) return;
      const [x, y] = worldToCanvas(pos.x, pos.y);
      //posMap[driver.driverNumber] = { x: pos.x, y: pos.y, elapsed: pos.elapsed };

      ctx.save();

      // car dot
      ctx.fillStyle = `#${driver.color}`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = outline;
      ctx.stroke();

      // label
      ctx.font = `600 ${labelSize}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#ffffffde";
      ctx.fillText(driver.acronym, x, y - labelOffset);

      ctx.restore();
    });
    //currentPositionsRef.current = posMap;
    //setCurrentPositions(posMap);
  };

  // Draw traces up to current time
  const drawTrajectories = (
    ctx: CanvasRenderingContext2D,
    progress: number
  ) => {
    // Use master timeline to draw each driver's trajectory up to their own progress.
    // This ensures slower drivers' traces continue after faster drivers finish.
    const masterLap = masterLapTimeRef.current ?? 0;
    const masterElapsed = progress * masterLap;

    processedDrivers.forEach((driver) => {
      const fastestMax = Math.max(...driver.locations.map((l) => l.elapsed));
      const driverFrac =
        driver.lapDuration > 0
          ? Math.min(1, masterElapsed / driver.lapDuration)
          : Math.min(1, progress);
      const currentTime = driverFrac * fastestMax;

      ctx.save();
      ctx.strokeStyle = `#${driver.color}66`;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let started = false;
      driver.locations.forEach((p) => {
        if (p.elapsed <= currentTime) {
          const [x, y] = worldToCanvas(p.x, p.y);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();
      ctx.restore();
    });
  };

  // Render
  const render = () => {
    const ctx = setupCanvas();
    if (!ctx || !bounds) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);

    // grid
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < rect.width; i += 50) ctx.fillRect(i, 0, 1, rect.height);
    for (let j = 0; j < rect.height; j += 50) ctx.fillRect(0, j, rect.width, 1);
    ctx.restore();

    drawTrack(ctx);
    const p = progressRef.current;
    drawTrajectories(ctx, p);
    drawCars(ctx, p);
  };
  /**
   * // Click handler to log world x,y of nearest car
   * useEffect(() => {
   *   const canvas = canvasRef.current;
   *   if (!canvas) return;
   *   const onClick = (e: MouseEvent) => {
   *     if (!bounds || Object.keys(currentPositionsRef.current).length === 0) return;
   *     const rect = canvas.getBoundingClientRect();
   *     const cx = e.clientX - rect.left;
   *     const cy = e.clientY - rect.top;
   *     let best: { dn: number; dist: number; wx: number; wy: number } | null = null;
   *     for (const [k, v] of Object.entries(currentPositionsRef.current)) {
   *       const [px, py] = worldToCanvas(v.x, v.y);
   *       const dx = px - cx;
   *       const dy = py - cy;
   *       const d2 = dx * dx + dy * dy;
   *       if (!best || d2 < best!.dist) best = { dn: Number(k), dist: d2, wx: v.x, wy: v.y };
   *     }
   *     if (best && best.dist <= 400) {
   *       // eslint-disable-next-line no-console
   *       console.log(`Car ${best.dn} @ x=${best.wx.toFixed(2)}, y=${best.wy.toFixed(2)}`);
   *     }
   *   };
   *   canvas.addEventListener('click', onClick);
   *   return () => canvas.removeEventListener('click', onClick);
   *   // eslint-disable-next-line react-hooks/exhaustive-deps
   * }, [bounds, processedDrivers.length]);
   */

  // RAF loop
  const animate = (ts: number) => {
    if (!lastTimestampRef.current) lastTimestampRef.current = ts;
    const deltaTime = (ts - lastTimestampRef.current) / 1000; // seconds
    lastTimestampRef.current = ts;

    if (animationState.isPlaying && processedDrivers.length > 0) {
      // use master (slowest) lap time as canonical timeline; fallback to max driver lap
      const master =
        masterLapTimeRef.current ??
        Math.max(...processedDrivers.map((d) => d.lapDuration));
      const denom = Math.max(master, 0.0001);
      const progressIncrement = (deltaTime / denom) * animationState.speed;
      const next = Math.min(1, progressRef.current + progressIncrement);
      progressRef.current = next;
      // Always sync the shared store so other panels (telemetry) stay frame-accurate
      setAnimationProgress(progressRef.current);
      // Lightly sync local UI state (slider) at ~6-10 fps to avoid re-render every frame
      if (ts - lastUIUpdateRef.current > 150) {
        lastUIUpdateRef.current = ts;
        setAnimationState((prev) => ({
          ...prev,
          progress: progressRef.current,
        }));
      }
      if (next >= 1) {
        // Stop at end of slowest lap and snap progress to 1.0 for UI consumers
        progressRef.current = 1;
        setAnimationState((prev) => ({
          ...prev,
          isPlaying: false,
          progress: 1,
        }));
        setAnimationProgress(1);
        setIsPlaying(false);
      }
    }

    render();
    animationRef.current = requestAnimationFrame(animate);
  };

  // Start/stop loop when drivers load
  useEffect(() => {
    if (processedDrivers.length > 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedDrivers]);

  // Restart on play/speed change
  useEffect(() => {
    if (processedDrivers.length === 0) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationState.isPlaying, animationState.speed]);

  // Autoplay when data ready
  useEffect(() => {
    if (processedDrivers.length > 0 && !animationState.isPlaying) {
      progressRef.current = 0;
      setAnimationState((p) => ({ ...p, isPlaying: true, progress: 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedDrivers.length]);

  // Re-render on data/progress
  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData, animationState.progress]);

  // Resize
  useEffect(() => {
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === ZOOM + PAN handlers ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;
    let lastX = 0,
      lastY = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!bounds) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = Math.exp((-e.deltaY / 100) * 0.2);
      const oldZoom = cameraRef.current.zoom;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const { panX, panY } = cameraRef.current;

      // keep cursor-anchored position stable
      const baseX = (mx - cx - panX) / oldZoom + cx;
      const baseY = (my - cy - panY) / oldZoom + cy;

      cameraRef.current.zoom = newZoom;
      cameraRef.current.panX = mx - (baseX - cx) * newZoom - cx;
      cameraRef.current.panY = my - (baseY - cy) * newZoom - cy;
      // no render() here — RAF will repaint
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      cameraRef.current.panX += dx;
      cameraRef.current.panY += dy;
      // no render() here — RAF will repaint
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      canvas.style.cursor = "grab";
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onDoubleClick = () => {
      cameraRef.current = { zoom: 1, panX: 0, panY: 0 };
      // no render() — RAF will repaint
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDoubleClick);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  const togglePlayPause = () => {
    setAnimationState((prev) => {
      if (!prev.isPlaying) lastTimestampRef.current = 0; // fresh delta after resume
      return { ...prev, isPlaying: !prev.isPlaying };
    });
  };

  const resetAnimation = () => {
    progressRef.current = 0;
    setAnimationState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
    setAnimationProgress(0);
    render();
  };

  function getDriverColor(driverNumber: number): string {
    const colors = ["ED1131", "FF8000", "005AFF", "2D826D", "DC143C", "F58020"];
    return colors[driverNumber % colors.length];
  }

  if (!selectedSession) {
    return (
      <Card className="w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex items-center justify-center border-0 bg-transparent shadow-none py-0">
        <CardContent className="p-0 w-full h-full">
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
      <Card className="w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex items-center justify-center border-0 bg-transparent shadow-none py-0">
        <CardContent className="p-0 w-full h-full">
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
    <Card className="rounded-xl overflow-hidden border-0 bg-transparent shadow-none w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex flex-col py-0">
      <CardContent className="p-0 flex-1">
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                Loading track data...
              </p>
            </div>
          </div>
        ) : processedDrivers.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center">
              <p className="text-muted-foreground">
                No GPS data available for selected drivers
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative h-full">
              <canvas
                ref={canvasRef}
                className="w-full h-full bg-zinc-900 rounded-lg"
                style={{ imageRendering: "auto", touchAction: "none" }}
              />

              {/* Controls overlay - single full-width bar */}
              <div className="pointer-events-none absolute inset-0 flex items-end p-3">
                <div className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-[12px] px-2 py-1.5 sm:px-3 sm:py-2 bg-[rgba(15,15,18,0.65)] backdrop-blur-md border border-[#2a2b31] overflow-x-auto whitespace-nowrap">
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={togglePlayPause}
                      disabled={isLoading || processedDrivers.length === 0}
                      title={animationState.isPlaying ? "Pause" : "Play"}
                    >
                      {animationState.isPlaying ? (
                        <Pause className="w-[14px] h-[14px]" />
                      ) : (
                        <Play className="w-[14px] h-[14px]" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={resetAnimation}
                      disabled={isLoading || processedDrivers.length === 0}
                      title="Restart"
                    >
                      <RotateCcw className="w-[14px] h-[14px]" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs leading-none"
                      onClick={() => {
                        cameraRef.current = { zoom: 1, panX: 0, panY: 0 };
                        render();
                      }}
                      disabled={isLoading || processedDrivers.length === 0}
                    >
                      Reset View
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 flex-nowrap">
                    <div className="flex items-center gap-2 w-56 shrink-0">
                      <span className="text-xs text-zinc-300">Progress</span>
                      <Slider
                        value={[animationState.progress * 100]}
                        onValueChange={(value) => {
                          const p = value[0] / 100;
                          progressRef.current = p;
                          setAnimationState((prev) => ({
                            ...prev,
                            progress: p,
                          }));
                          setAnimationProgress(p);
                          render();
                        }}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                      <span className="text-xs text-zinc-400 w-8 text-right">
                        {Math.round(animationState.progress * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-40 shrink-0">
                      <span className="text-xs text-zinc-300">Speed</span>
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
                      <span className="text-xs text-zinc-400 w-8 text-right">
                        {animationState.speed.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
