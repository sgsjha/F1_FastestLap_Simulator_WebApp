"use client";

import type React from "react";

import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Trophy,
  Gauge,
  MapIcon,
  Star,
  Sparkles,
  Mail,
  Github,
  Linkedin,
  Instagram,
} from "lucide-react";

export default function HomeLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* Racing grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none -z-10"
        style={{
          backgroundImage: `
          linear-gradient(rgba(251, 191, 36, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(251, 191, 36, 0.3) 1px, transparent 1px)
        `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-zinc-800/60">
        <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent)]">
          <div className="absolute -top-24 -left-24 w-[600px] h-[600px] bg-gradient-to-br from-fuchsia-600/30 to-indigo-600/30 blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] bg-gradient-to-br from-emerald-600/30 to-cyan-600/30 blur-3xl animate-pulse" />
        </div>

        {/* Checkered flag pattern */}
        <div className="absolute top-4 right-4 w-16 h-12 opacity-10">
          <div className="grid grid-cols-4 grid-rows-3 w-full h-full">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className={`${
                  (Math.floor(i / 4) + i) % 2 === 0 ? "bg-white" : "bg-black"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            Real-time F1 telemetry visualizer
            <div className="flex gap-1 ml-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <div
                className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="w-2 h-2 bg-fuchsia-500 rounded-full animate-ping"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>

          <h1 className="mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-zinc-100">
            Simulate and analyze the fastest laps in F1
          </h1>

          <p className="mt-4 max-w-2xl text-zinc-300 text-base sm:text-lg leading-relaxed">
            Compare drivers on a live track canvas, inspect telemetry, and spot
            the session's fastest performers—all in one streamlined view.
            <span className="text-amber-400 font-semibold">
              {" "}
              Experience racing like never before.
            </span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/analyse"
              className="group inline-flex items-center gap-2 rounded-lg bg-zinc-100 text-zinc-900 px-6 py-3 font-semibold hover:bg-white transition-all duration-300 shadow-lg transform hover:scale-105"
            >
              <Trophy className="w-4 h-4" />
              Start analyzing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://github.com/sgsjha/F1_FastestLap_Simulator_WebApp"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 text-zinc-200 hover:bg-zinc-900/60 hover:border-amber-500/50 transition-all duration-300"
              rel="noreferrer"
            >
              <Star className="w-4 h-4" />
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
            accent="amber"
          />
          <FeatureCard
            icon={<Gauge className="w-5 h-5" />}
            title="Live telemetry"
            desc="Speed, gear, RPM, throttle/brake, and DRS with accurate timing."
            accent="emerald"
          />
          <FeatureCard
            icon={<Trophy className="w-5 h-5" />}
            title="Fastest indicators"
            desc="Automatic badges for session-fastest and fastest among selections."
            accent="fuchsia"
          />
        </div>

        {/* Tech Stack Card */}
        <section className="mt-12 sm:mt-16 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-6 sm:p-8 relative overflow-hidden">
          {/* Grid pattern background */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
              linear-gradient(rgba(251, 191, 36, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(251, 191, 36, 0.5) 1px, transparent 1px)
            `,
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-zinc-100 font-semibold">Built with</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <TechBadge>React</TechBadge>
              <TechBadge>Next.js 15</TechBadge>
              <TechBadge>TypeScript</TechBadge>
              <TechBadge>Tailwind CSS</TechBadge>
              <TechBadge>Vercel</TechBadge>
              <TechBadge>React Query</TechBadge>
              <TechBadge>Zustand</TechBadge>
              <TechBadge>Open F1 API</TechBadge>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm p-6 sm:p-8 relative">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            How it works
          </h2>
          <ol className="mt-4 grid gap-3 text-zinc-300 list-decimal list-inside">
            <li className="hover:text-white transition-colors">
              Select a session and drivers
            </li>
            <li className="hover:text-white transition-colors">
              Play the synced track animation
            </li>
            <li className="hover:text-white transition-colors">
              Inspect telemetry and compare lap times
            </li>
          </ol>
          <div className="mt-6">
            <Link
              href="/analyse"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900/60 hover:border-amber-500/50 transition-all duration-300 group"
            >
              <Gauge className="w-4 h-4 text-amber-400" />
              Go to Analyzer
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
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
              <p>Get in touch for collaborations</p>
              <a
                href="mailto:contact@f1telemetry.com"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                contact@f1telemetry.com
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
          <p>
            &copy; 2024 F1 Telemetry Visualizer. Racing data visualization
            reimagined.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  accent = "amber",
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent?: "amber" | "emerald" | "fuchsia";
}) {
  const accentColors = {
    amber: "text-amber-400 group-hover:text-amber-300",
    emerald: "text-emerald-400 group-hover:text-emerald-300",
    fuchsia: "text-fuchsia-400 group-hover:text-fuchsia-300",
  };

  const borderColors = {
    amber: "hover:border-amber-500/30",
    emerald: "hover:border-emerald-500/30",
    fuchsia: "hover:border-fuchsia-500/30",
  };

  return (
    <div
      className={`group rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-4 sm:p-5 hover:bg-zinc-900/60 transition-all duration-300 ${borderColors[accent]} transform hover:scale-105`}
    >
      <div
        className={`flex items-center gap-2 ${accentColors[accent]} transition-colors`}
      >
        {icon}
      </div>
      <h3 className="mt-2 text-lg font-semibold group-hover:text-white transition-colors">
        {title}
      </h3>
      <p className="mt-1 text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

function TechBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-zinc-800/60 text-zinc-200 border border-zinc-700/60 hover:bg-zinc-700/60 hover:border-amber-500/30 transition-all duration-300 hover:scale-105">
      {children}
    </span>
  );
}
