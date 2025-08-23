import { LapData } from '@/lib/types';

export interface FastestLapResult {
  fastestLap: {
    lapNumber: number;
    lapTime: number;
    startTime: string;
    endTime: string;
    driverNumber: number;
    sessionKey: number;
    meetingKey: number;
  };
  summary: {
    totalLaps: number;
    validRacingLaps: number;
    fastestLapNumber: number;
    fastestLapTime: string;
  };
  allValidLaps: Array<{
    lapNumber: number;
    lapTime: number;
    startTime: string;
  }>;
}

/**
 * Calculates the fastest lap from F1 lap data and generates timing information
 * Based on your original calculateFastestLap function but adapted for TypeScript
 */
export function calculateFastestLap(lapData: LapData[]): FastestLapResult {
  // Validate input
  if (!Array.isArray(lapData) || lapData.length === 0) {
    throw new Error('lapData must be a non-empty array');
  }

  // Filter out invalid laps (pit out laps and laps with null duration)
  const validLaps = lapData.filter(lap => {
    return lap.lap_duration !== null && 
           lap.lap_duration !== undefined && 
           !lap.is_pit_out_lap &&
           lap.lap_duration > 0; // Additional safety check
  });

  if (validLaps.length === 0) {
    throw new Error('No valid racing laps found in the data');
  }

  // Find the fastest lap
  const fastestLap = validLaps.reduce((fastest, current) => {
    return current.lap_duration! < fastest.lap_duration! ? current : fastest;
  });

  // Calculate end time (start time + lap duration)
  const startTime = new Date(fastestLap.date_start);
  const endTime = new Date(startTime.getTime() + (fastestLap.lap_duration! * 1000));

  // Format dates for API query (ISO format)
  const formatDateForAPI = (date: Date): string => {
    return date.toISOString();
  };

  const startTimeFormatted = formatDateForAPI(startTime);
  const endTimeFormatted = formatDateForAPI(endTime);

  // Sort all valid laps by lap time for analysis
  const sortedValidLaps = validLaps
    .map(lap => ({
      lapNumber: lap.lap_number,
      lapTime: lap.lap_duration!,
      startTime: formatDateForAPI(new Date(lap.date_start))
    }))
    .sort((a, b) => a.lapTime - b.lapTime);

  // Return comprehensive result
  return {
    fastestLap: {
      lapNumber: fastestLap.lap_number,
      lapTime: fastestLap.lap_duration!,
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      driverNumber: fastestLap.driver_number,
      sessionKey: fastestLap.session_key,
      meetingKey: fastestLap.meeting_key
    },
    summary: {
      totalLaps: lapData.length,
      validRacingLaps: validLaps.length,
      fastestLapNumber: fastestLap.lap_number,
      fastestLapTime: `${fastestLap.lap_duration!.toFixed(3)}s`
    },
    allValidLaps: sortedValidLaps
  };
}

/**
 * Compare fastest laps between multiple drivers
 */
export function compareFastestLaps(driversData: Record<string, LapData[]>) {
  const results: Record<string, FastestLapResult | { error: string }> = {};
  
  Object.keys(driversData).forEach(driverKey => {
    try {
      results[driverKey] = calculateFastestLap(driversData[driverKey]);
    } catch (error) {
      results[driverKey] = { error: (error as Error).message };
    }
  });
  
  // Find overall fastest
  const validResults = Object.entries(results)
    .filter(([_, result]) => !('error' in result))
    .map(([driver, result]) => ({
      driver,
      lapTime: (result as FastestLapResult).fastestLap.lapTime,
      lapNumber: (result as FastestLapResult).fastestLap.lapNumber
    }))
    .sort((a, b) => a.lapTime - b.lapTime);
  
  return {
    byDriver: results,
    overallFastest: validResults[0] || null,
    leaderboard: validResults
  };
}

/**
 * Calculate sector times and performance metrics
 */
export function analyzeSectorPerformance(lapData: LapData[]) {
  const validLaps = lapData.filter(lap => 
    lap.lap_duration !== null && 
    !lap.is_pit_out_lap &&
    lap.duration_sector_1 !== null &&
    lap.duration_sector_2 !== null &&
    lap.duration_sector_3 !== null
  );

  if (validLaps.length === 0) {
    return null;
  }

  // Find best sectors
  const bestSector1 = Math.min(...validLaps.map(lap => lap.duration_sector_1!));
  const bestSector2 = Math.min(...validLaps.map(lap => lap.duration_sector_2!));
  const bestSector3 = Math.min(...validLaps.map(lap => lap.duration_sector_3!));

  // Theoretical best lap (sum of best sectors)
  const theoreticalBest = bestSector1 + bestSector2 + bestSector3;

  // Find actual fastest lap with sector data
  const fastestLapWithSectors = validLaps.reduce((fastest, current) => {
    return current.lap_duration! < fastest.lap_duration! ? current : fastest;
  });

  return {
    bestSectors: {
      sector1: bestSector1,
      sector2: bestSector2,
      sector3: bestSector3
    },
    theoreticalBest,
    actualFastest: fastestLapWithSectors.lap_duration!,
    improvement: theoreticalBest - fastestLapWithSectors.lap_duration!,
    fastestLapSectors: {
      sector1: fastestLapWithSectors.duration_sector_1!,
      sector2: fastestLapWithSectors.duration_sector_2!,
      sector3: fastestLapWithSectors.duration_sector_3!
    }
  };
}