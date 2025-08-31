"use client";

import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Timer, User } from "lucide-react";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";

export function DriverSelector() {
  const { selectedSession, selectedDrivers, toggleDriver } = useRaceStore();

  const {
    data: drivers,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["drivers", selectedSession?.session_key],
    queryFn: () =>
      selectedSession
        ? f1Api.getDrivers(selectedSession.session_key)
        : Promise.resolve([]),
    enabled: !!selectedSession,
  });

  // Find the fastest driver among currently selected (by fastest lap time)
  const { data: fastestInfo } = useQuery<{
    fastestDriverNumber: number;
    lapTime: number;
  } | null>({
    queryKey: ["fastest-driver", selectedSession?.session_key, selectedDrivers],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0) return null;
      const lapResults = await Promise.all(
        selectedDrivers.map(async (driverNumber) => {
          try {
            const laps = await f1Api.getLaps(
              selectedSession.session_key,
              driverNumber
            );
            if (!laps || laps.length === 0) return null;
            const fastest = calculateFastestLap(laps);
            return {
              driverNumber,
              lapTime: fastest.fastestLap.lapTime,
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
      return {
        fastestDriverNumber: valid[0].driverNumber,
        lapTime: valid[0].lapTime,
      };
    },
    enabled: !!(selectedSession && selectedDrivers.length > 0),
    staleTime: 30_000,
  });

  if (!selectedSession) {
    return (
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <User className="w-5 h-5 text-zinc-400" />
            Select Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">
            Choose a race session first to see available drivers.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <User className="w-5 h-5 text-zinc-400" />
            Select Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-zinc-800 animate-pulse" />
                <div className="h-4 w-32 rounded bg-zinc-800 animate-pulse" />
                <div className="h-5 w-16 rounded bg-zinc-800 animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <User className="w-5 h-5 text-zinc-400" />
            Select Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">
            Failed to load drivers. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-950 border-zinc-800 w-full h-[500px] lg:h-[70vh] xl:h-[80vh] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <User className="w-5 h-5 text-zinc-400" />
          Select Drivers
          {selectedDrivers.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 bg-zinc-800 text-zinc-200 border-zinc-700"
            >
              {selectedDrivers.length} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-2 h-full overflow-y-auto pr-1">
          {drivers?.map((driver) => {
            const isSelected = selectedDrivers.includes(driver.driver_number);
            const isFastest =
              fastestInfo?.fastestDriverNumber === driver.driver_number;
            return (
              <div
                key={driver.driver_number}
                className={[
                  "group px-2 py-1.5 rounded-md",
                  isSelected
                    ? "bg-zinc-900/60 border border-zinc-600"
                    : "bg-zinc-900/30 hover:bg-zinc-900/40",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`driver-${driver.driver_number}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleDriver(driver.driver_number)}
                    className="w-4 h-4 border-zinc-700 data-[state=checked]:bg-zinc-700 data-[state=checked]:border-zinc-600"
                  />
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: `#${driver.team_colour}` }}
                  />
                  <label
                    htmlFor={`driver-${driver.driver_number}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="text-sm font-semibold tracking-wide text-zinc-100 leading-tight truncate inline-flex items-center gap-1">
                      <span>{driver.name_acronym}</span>
                      <span className="ml-1 text-xs text-zinc-400">
                        #{driver.driver_number}
                      </span>
                      {isFastest && (
                        <span title="Fastest lap among selected">
                          <Timer
                            className="w-3.5 h-3.5 text-purple-400"
                            aria-label="Fastest driver"
                          />
                        </span>
                      )}
                    </span>
                  </label>
                </div>
                <div className="pl-8 text-xs text-zinc-400 truncate">
                  {driver.full_name} • {driver.team_name}
                </div>
              </div>
            );
          })}
        </div>

        {selectedDrivers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-400 mb-2">
              Selected for comparison:
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedDrivers.map((driverNumber) => {
                const driver = drivers?.find(
                  (d) => d.driver_number === driverNumber
                );
                return driver ? (
                  <Badge
                    key={driverNumber}
                    variant="outline"
                    className="text-xs bg-zinc-900/60 text-zinc-200 border"
                    style={{ borderColor: `#${driver.team_colour}` }}
                  >
                    {driver.name_acronym}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
