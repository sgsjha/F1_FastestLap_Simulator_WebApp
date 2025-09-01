"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RaceSelector } from "@/components/race-selector/RaceSelector";
import { DriverSelector } from "@/components/driver-selector/DriverSelector";
import { TrackVisualization } from "@/components/track-visualization/TrackVisualization";
import TelemetryPanel from "@/components/telemetry-panel/TelemetryPanel";

const queryClient = new QueryClient();

export default function Analyse() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur">
          <div className="w-full px-3 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                F1 Race Analyzer
              </h1>
              <p className="text-zinc-400 mt-1 text-sm sm:text-base">
                Compare driver performance across the last 3 seasons
              </p>
            </div>
            <div className="w-full md:w-auto md:shrink-0">
              <RaceSelector />
            </div>
          </div>
        </header>

        <main className="w-full px-3 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start w-full">
            <div className="space-y-3 order-1 lg:col-span-3 xl:col-span-3">
              <DriverSelector />
            </div>
            <div className="order-2 w-full lg:col-span-6 xl:col-span-6">
              <TrackVisualization />
            </div>
            <div className="space-y-3 order-3 w-full lg:col-span-3 xl:col-span-3">
              <TelemetryPanel />
            </div>
          </div>
        </main>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
