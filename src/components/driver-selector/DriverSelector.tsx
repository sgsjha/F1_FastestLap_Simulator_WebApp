"use client";

import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User, Eye } from "lucide-react";

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
    <Card className="bg-zinc-950 border-zinc-800 w-full">
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

      <CardContent>
        <div className="space-y-2 max-h-80 lg:max-h-[70vh] xl:max-h-[80vh] overflow-y-auto pr-1">
          {drivers?.map((driver) => {
            const isSelected = selectedDrivers.includes(driver.driver_number);
            return (
              <div
                key={driver.driver_number}
                className={[
                  "group grid grid-cols-[auto,1fr,auto] items-center gap-3 px-2 py-2 rounded-lg border",
                  isSelected
                    ? "bg-zinc-900/70 border-zinc-700"
                    : "bg-zinc-900/30 border-transparent hover:border-zinc-800 hover:bg-zinc-900/50",
                ].join(" ")}
              >
                <Checkbox
                  id={`driver-${driver.driver_number}`}
                  checked={isSelected}
                  onCheckedChange={() => toggleDriver(driver.driver_number)}
                  className="data-[state=checked]:bg-zinc-100 data-[state=checked]:border-zinc-100"
                />

                <label
                  htmlFor={`driver-${driver.driver_number}`}
                  className="flex min-w-0 items-center gap-2 cursor-pointer"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: `#${driver.team_colour}` }}
                  />
                  <span className="text-sm font-semibold tracking-wide text-zinc-100 truncate">
                    {driver.name_acronym}
                  </span>
                  <span className="text-xs text-zinc-400">
                    #{driver.driver_number}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500 truncate">
                    {driver.full_name} • {driver.team_name}
                  </span>
                </label>

                {/* Eye indicator (read-only visual) */}
                <div className="flex items-center">
                  <Eye
                    className={[
                      "w-4 h-4 transition-opacity",
                      isSelected
                        ? "text-emerald-400 opacity-100"
                        : "text-zinc-600 opacity-40",
                    ].join(" ")}
                    aria-hidden="true"
                  />
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
