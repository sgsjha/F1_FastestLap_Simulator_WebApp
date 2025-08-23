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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Race
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load sessions. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Select Race
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Year Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Season</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={handleYearChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year} Season
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Race Weekend Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Race Weekend</label>
          <Select
            value={selectedMeetingKey?.toString() || ""}
            onValueChange={(meetingKey) => {
              setSelectedMeetingKey(parseInt(meetingKey));
              // Clear session selection when race weekend changes
              setSelectedSession(null);
            }}
            disabled={!sessions || isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoading ? "Loading races..." : "Select race weekend"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {Object.values(groupedSessions).map((meeting: any) => (
                <SelectItem
                  key={meeting.meeting_key}
                  value={meeting.meeting_key.toString()}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span>{meeting.location}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(meeting.date_start), "MMM d")}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Session Type Selection */}
        {selectedMeetingKey && (
          <div>
            <label className="text-sm font-medium mb-2 block">Session</label>
            <Select
              value={selectedSession?.session_key?.toString() || ""}
              onValueChange={handleSessionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {groupedSessions[selectedMeetingKey]?.sessions
                  .sort(
                    (a: any, b: any) =>
                      new Date(a.date_start).getTime() -
                      new Date(b.date_start).getTime()
                  )
                  .map((session: any) => (
                    <SelectItem
                      key={session.session_key}
                      value={session.session_key.toString()}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            session.session_type === "Race"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {session.session_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(session.date_start), "EEE HH:mm")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected Session Info */}
        {selectedSession && (
          <div className="mt-4 p-3 bg-muted/20 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedSession.location}
                </span>
                <Badge variant="outline" className="text-xs">
                  {selectedSession.session_name}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{selectedSession.circuit_short_name}</p>
                <p>
                  {selectedSession.country_name} • {selectedYear}
                </p>
                <p>{format(new Date(selectedSession.date_start), "PPPP")}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
