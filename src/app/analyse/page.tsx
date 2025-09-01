"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RaceSelector } from "@/components/race-selector/RaceSelector";
import { DriverSelector } from "@/components/driver-selector/DriverSelector";
import { TrackVisualization } from "@/components/track-visualization/TrackVisualization";
import TelemetryPanel from "@/components/telemetry-panel/TelemetryPanel";
import { Mail, Github, Linkedin, Instagram } from "lucide-react";

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

        <footer className="mx-auto max-w-6xl px-4 py-12 border-t border-zinc-800/60">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                Contact
              </h3>
              <div className="space-y-2 text-zinc-300">
                <p>Get in touch : I am open to work !</p>
                <a
                  href="mailto:sarthak.jhaa11@gmail.com"
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  sarthak.jhaa11@gmail.com
                </a>
              </div>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                Connect
              </h3>
              <div className="flex flex-col space-y-3">
                <a
                  href="https://www.linkedin.com/in/sarthak-jhaa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-300 hover:text-fuchsia-400 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
                <a
                  href="https://github.com/sgsjha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="https://instagram.com/sarthak.jhaa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-300 hover:text-emerald-400 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </a>
              </div>
            </div>

            {/* Project Info */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                Project
              </h3>
              <div className="space-y-2 text-zinc-300">
                <p>Open source F1 telemetry visualizer</p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  Built with passion for racing
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-zinc-800/40 text-center text-sm text-zinc-400">
            <p>&copy; Sarthak Jha 2025. F1 Fastest Lap Simulator</p>
          </div>
        </footer>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
