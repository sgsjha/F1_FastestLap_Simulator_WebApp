"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RaceSelector } from "@/components/race-selector/RaceSelector";
import { DriverSelector } from "@/components/driver-selector/DriverSelector";
import { TrackVisualization } from "@/components/track-visualization/TrackVisualization";
import TelemetryPanel from "@/components/telemetry-panel/TelemetryPanel";

const queryClient = new QueryClient();

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        <header className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur">
          <div className="w-full px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">F1 Race Analyzer</h1>
              <p className="text-zinc-400 mt-1">Compare driver performance across the last 10 seasons</p>
            </div>
            <div className="shrink-0">
              <RaceSelector />
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
            <div className="space-y-6 order-1">
              <DriverSelector />
            </div>
            <div className="order-2 w-full">
              <TrackVisualization />
            </div>
            <div className="space-y-6 order-3 w-full">
              <TelemetryPanel />
            </div>
          </div>
        </main>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
