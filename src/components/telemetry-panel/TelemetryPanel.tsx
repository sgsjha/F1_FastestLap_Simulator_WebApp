"use client";

import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { Activity, Clock, Zap, TrendingUp } from "lucide-react";
import { calculateFastestLap } from "@/lib/utils/lapCalculator";

export function TelemetryPanel() {
  const { selectedSession, selectedDrivers } = useRaceStore();

  const { data: lapData, isLoading } = useQuery({
    queryKey: ["telemetry", selectedSession?.session_key, selectedDrivers],
    queryFn: async () => {
      if (!selectedSession || selectedDrivers.length === 0) return {};

      const results = await Promise.all(
        selectedDrivers.map(async (driverNumber) => {
          const laps = await f1Api.getLaps(
            selectedSession.session_key,
            driverNumber
          );
          const fastestLapInfo = calculateFastestLap(laps);

          return {
            driverNumber,
            laps,
            fastestLap: fastestLapInfo.fastestLap,
            summary: fastestLapInfo.summary,
          };
        })
      );

      return results.reduce((acc, item) => {
        acc[item.driverNumber] = item;
        return acc;
      }, {} as Record<number, any>);
    },
    enabled: !!(selectedSession && selectedDrivers.length > 0),
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers", selectedSession?.session_key],
    queryFn: () =>
      selectedSession
        ? f1Api.getDrivers(selectedSession.session_key)
        : Promise.resolve([]),
    enabled: !!selectedSession,
  });

  if (!selectedSession || selectedDrivers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Telemetry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select drivers to view telemetry data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Telemetry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = Object.entries(lapData || {})
    .map(([driverNumber, data]: [string, any]) => {
      const driver = drivers?.find(
        (d) => d.driver_number === parseInt(driverNumber)
      );
      return {
        driver: driver?.name_acronym || `#${driverNumber}`,
        lapTime: data.fastestLap.lapTime,
        color: `#${driver?.team_colour || "666666"}`,
        totalLaps: data.summary.totalLaps,
        validLaps: data.summary.validRacingLaps,
      };
    })
    .sort((a, b) => a.lapTime - b.lapTime);

  const sectorData = Object.entries(lapData || {}).flatMap(
    ([driverNumber, data]: [string, any]) => {
      const driver = drivers?.find(
        (d) => d.driver_number === parseInt(driverNumber)
      );
      const fastestValidLap = data.laps.find(
        (lap: any) =>
          lap.lap_duration === data.fastestLap.lapTime &&
          lap.duration_sector_1 &&
          lap.duration_sector_2 &&
          lap.duration_sector_3
      );

      if (!fastestValidLap) return [];

      return [
        {
          driver: driver?.name_acronym || `#${driverNumber}`,
          sector: "S1",
          time: fastestValidLap.duration_sector_1,
          color: `#${driver?.team_colour || "666666"}`,
        },
        {
          driver: driver?.name_acronym || `#${driverNumber}`,
          sector: "S2",
          time: fastestValidLap.duration_sector_2,
          color: `#${driver?.team_colour || "666666"}`,
        },
        {
          driver: driver?.name_acronym || `#${driverNumber}`,
          sector: "S3",
          time: fastestValidLap.duration_sector_3,
          color: `#${driver?.team_colour || "666666"}`,
        },
      ];
    }
  );

  return (
    <div className="space-y-4">
      {/* Fastest Lap Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Fastest Lap Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chartData.map((item, index) => (
              <div key={item.driver} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium">{item.driver}</span>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">
                        Fastest
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-xs">
                    {item.lapTime.toFixed(3)}s
                  </span>
                </div>
                <Progress
                  value={
                    100 -
                    ((item.lapTime - chartData[0].lapTime) /
                      chartData[0].lapTime) *
                      100
                  }
                  className="h-2"
                />
                {index > 0 && (
                  <p className="text-xs text-muted-foreground">
                    +{(item.lapTime - chartData[0].lapTime).toFixed(3)}s
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lap Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Lap Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(lapData || {}).map(
              ([driverNumber, data]: [string, any]) => {
                const driver = drivers?.find(
                  (d) => d.driver_number === parseInt(driverNumber)
                );
                return (
                  <div key={driverNumber} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: `#${
                              driver?.team_colour || "666666"
                            }`,
                          }}
                        />
                        <span className="font-medium text-sm">
                          {driver?.name_acronym || `#${driverNumber}`}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {data.summary.validRacingLaps}/{data.summary.totalLaps}{" "}
                        laps
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Fastest Lap</p>
                        <p className="font-mono">
                          {data.fastestLap.lapTime.toFixed(3)}s
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Lap #{data.fastestLap.lapNumber}
                        </p>
                        <p className="font-mono">
                          {new Date(
                            data.fastestLap.startTime
                          ).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sector Comparison */}
      {sectorData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Sector Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="sector"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value) => `${value.toFixed(1)}s`}
                  />
                  <Tooltip
                    formatter={(value: any, name, props) => [
                      `${value.toFixed(3)}s`,
                      props.payload?.driver,
                    ]}
                    labelStyle={{ color: "#1f2937" }}
                    contentStyle={{
                      backgroundColor: "#374151",
                      border: "none",
                      borderRadius: "8px",
                      color: "#ffffff",
                    }}
                  />
                  <Bar dataKey="time" radius={[2, 2, 0, 0]}>
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">
                Session: {selectedSession?.session_name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {selectedSession?.location} •{" "}
                {new Date(
                  selectedSession?.date_start || ""
                ).toLocaleDateString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground">Drivers Compared</p>
                <p className="font-medium">{selectedDrivers.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fastest Overall</p>
                <p className="font-medium">
                  {chartData[0]?.driver || "N/A"} -{" "}
                  {chartData[0]?.lapTime.toFixed(3) || "N/A"}s
                </p>
              </div>
            </div>

            {chartData.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Gap to Leader
                </p>
                <div className="space-y-1">
                  {chartData.slice(1).map((item, index) => (
                    <div
                      key={item.driver}
                      className="flex justify-between text-xs"
                    >
                      <span>{item.driver}</span>
                      <span className="font-mono text-muted-foreground">
                        +{(item.lapTime - chartData[0].lapTime).toFixed(3)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
