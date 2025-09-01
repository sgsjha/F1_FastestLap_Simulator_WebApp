"use client";

import Link from "next/link";
import { ArrowRight, Zap, Trophy, Gauge, Map as MapIcon } from "lucide-react";

export default function HomeLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-zinc-800/60">
        <div className="absolute inset-0 -z-10 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent)]">
          <div className="absolute -top-24 -left-24 w-[600px] h-[600px] bg-gradient-to-br from-fuchsia-600/30 to-indigo-600/30 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] bg-gradient-to-br from-emerald-600/30 to-cyan-600/30 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Zap className="w-4 h-4 text-amber-400" />
            Real-time F1 telemetry visualizer
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Simulate and analyze the fastest laps in F1
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300 text-base sm:text-lg">
            Compare drivers on a live track canvas, inspect telemetry, and spot
            the session’s fastest performers—all in one streamlined view.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/analyse"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2.5 font-semibold hover:bg-white transition"
            >
              Start analyzing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/sgsjha/F1_FastestLap_Simulator_WebApp"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-zinc-200 hover:bg-zinc-900/60"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Feature grid */}
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <FeatureCard
            icon={<MapIcon className="w-5 h-5" />}
            title="Track visualization"
            desc="Zoomable canvas with car traces, labels, and session-synced playback."
          />
          <FeatureCard
            icon={<Gauge className="w-5 h-5" />}
            title="Live telemetry"
            desc="Speed, gear, RPM, throttle/brake, and DRS with accurate timing."
          />
          <FeatureCard
            icon={<Trophy className="w-5 h-5" />}
            title="Fastest indicators"
            desc="Automatic badges for session-fastest and fastest among selections."
          />
        </div>

        <section className="mt-12 sm:mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-4 grid gap-3 text-zinc-300 list-decimal list-inside">
            <li>Select a session and drivers</li>
            <li>Play the synced track animation</li>
            <li>Inspect telemetry and compare lap times</li>
          </ol>
          <div className="mt-6">
            <Link
              href="/analyse"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900/60"
            >
              Go to Analyzer
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-zinc-500">
        Built with Next.js, React Query, Zustand, Tailwind, and love for racing.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-amber-300">{icon}</div>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-300">{desc}</p>
    </div>
  );
}
