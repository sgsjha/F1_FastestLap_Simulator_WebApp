"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/openf1";
import { useRaceStore } from "@/lib/store/raceStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { format } from "date-fns";

const YEARS = [2025, 2024, 2023];

export function RaceSelector() {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  // Track the selected meeting separately from the selected session
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<number | null>(
    null
  );
  const { selectedSession, setSelectedSession, reset } = useRaceStore();

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sessions", selectedYear],
    queryFn: () => f1Api.getSessions(selectedYear),
    enabled: !!selectedYear,
  });

  // Group sessions by meeting/race weekend
  const groupedSessions = useMemo(() => {
    if (!sessions) return {} as Record<number, any>;
    return sessions.reduce((acc, session) => {
      const key = session.meeting_key;
      if (!acc[key]) {
        acc[key] = {
          meeting_key: key,
          location: session.location,
          country_name: session.country_name,
          circuit_short_name: session.circuit_short_name,
          date_start: session.date_start,
          sessions: [],
        };
      }
      acc[key].sessions.push(session);
      return acc;
    }, {} as Record<number, any>);
  }, [sessions]);

  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year));
    setSelectedMeetingKey(null);
    setSelectedSession(null);
    reset(); // Clear any selected drivers when changing year
  };

  const handleSessionChange = (sessionKey: string) => {
    const session = sessions?.find(
      (s) => s.session_key === parseInt(sessionKey)
    );
    setSelectedSession(session || null);
  };

  if (error) {
    return (
      <div className="text-sm text-red-400">Failed to load sessions.</div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* Year */}
      <div className="w-auto">
        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="h-9 bg-zinc-900/50 border border-zinc-700 text-zinc-100 hover:bg-zinc-800/60 min-w-[110px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border border-zinc-700 text-zinc-100">
            {YEARS.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weekend */}
      <div className="w-auto">
        <Select
          value={selectedMeetingKey?.toString() || ""}
          onValueChange={(meetingKey) => {
            setSelectedMeetingKey(parseInt(meetingKey));
            setSelectedSession(null);
          }}
          disabled={!sessions || isLoading}
        >
          <SelectTrigger className="h-9 bg-zinc-900/50 border border-zinc-700 text-zinc-100 hover:bg-zinc-800/60 disabled:opacity-50 min-w-[200px]">
            <SelectValue placeholder={isLoading ? "Loading…" : "Weekend"} />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border border-zinc-700 text-zinc-100 max-h-80">
            {Object.values(groupedSessions).map((meeting: any) => (
              <SelectItem key={meeting.meeting_key} value={meeting.meeting_key.toString()}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  <span>{meeting.location}</span>
                  <span className="text-xs text-zinc-400">
                    {format(new Date(meeting.date_start), "MMM d")}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    {/* Session (wraps on small screens, fixed width) */}
    <div className="basis-full sm:basis-auto w-auto">
        <Select
          value={selectedSession?.session_key?.toString() || ""}
          onValueChange={handleSessionChange}
          disabled={!selectedMeetingKey}
        >
      <SelectTrigger className="h-9 min-w-[200px] bg-zinc-900/50 border border-zinc-700 text-zinc-100 hover:bg-zinc-800/60 disabled:opacity-50">
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border border-zinc-700 text-zinc-100 max-h-80">
            {selectedMeetingKey &&
              groupedSessions[selectedMeetingKey]?.sessions
                .sort(
                  (a: any, b: any) =>
                    new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
                )
                .map((session: any) => (
                  <SelectItem key={session.session_key} value={session.session_key.toString()}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={session.session_type === "Race" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {session.session_name}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        {format(new Date(session.date_start), "EEE HH:mm")}
                      </span>
                    </div>
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
