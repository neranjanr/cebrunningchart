'use client';

import React, { useEffect, useState } from 'react';
import {
  calculateTripDistance,
  calculateEndKm,
  getDayOfWeek,
  getTodayDateString,
  getCurrentTimeString,
  calculateDurationMinutes,
  calculateStartTimeFromEndAndDuration,
  parseDurationToMinutes,
  formatDurationMinutes,
  roundToOneDecimal,
} from '@/lib/tripCalculations';
import { getLastEndKm, saveTrip } from '@/lib/tripStore';

export default function QuickTripForm({ onSuccess }: { onSuccess?: () => void }) {
  const [date, setDate] = useState<string>(getTodayDateString());
  const [dayOfWeek, setDayOfWeek] = useState<string>(getDayOfWeek(getTodayDateString()));
  const [startKm, setStartKm] = useState<string>('');
  const [endKm, setEndKm] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>(getCurrentTimeString());
  const [duration, setDuration] = useState<string>('');
  const [tripType, setTripType] = useState<'Official' | 'Private'>('Official');
  const [placesVisited, setPlacesVisited] = useState<string>('');
  const [fuelPumped, setFuelPumped] = useState<string>('');
  const [fuelOrderNo, setFuelOrderNo] = useState<string>('');
  const [isAutoStartKm, setIsAutoStartKm] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    // Initialize defaults
    const today = getTodayDateString();
    const currentTime = getCurrentTimeString();
    if (mounted) {
      setDate(today);
      setDayOfWeek(getDayOfWeek(today));
      setEndTime(currentTime);
    }
    getLastEndKm().then((lastEnd) => {
      if (!mounted) return;
      const rounded = roundToOneDecimal(lastEnd);
      // Remove trailing .0 for display consistency but keep value as number string
      setStartKm(String(rounded));
      setIsAutoStartKm(true);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (date) {
      setDayOfWeek(getDayOfWeek(date));
    }
  }, [date]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDate(val);
    if (val) setDayOfWeek(getDayOfWeek(val));
  };

  const handleStartKmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStartKm(val);
    setIsAutoStartKm(false);
    const s = parseFloat(val);
    if (isNaN(s)) return;
    if (endKm !== '' && !isNaN(parseFloat(endKm))) {
      const d = calculateTripDistance(s, parseFloat(endKm));
      setDistance(String(d));
    } else if (distance !== '' && !isNaN(parseFloat(distance))) {
      const end = calculateEndKm(s, parseFloat(distance));
      setEndKm(String(end));
    }
  };

  const handleEndKmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndKm(val);
    const end = parseFloat(val);
    const start = parseFloat(startKm);
    if (!isNaN(end) && !isNaN(start)) {
      const d = calculateTripDistance(start, end);
      setDistance(String(d));
    } else if (val === '') {
      setDistance('');
    }
  };

  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDistance(val);
    const d = parseFloat(val);
    const start = parseFloat(startKm);
    if (!isNaN(d) && !isNaN(start)) {
      const end = calculateEndKm(start, d);
      setEndKm(String(end));
    } else if (val === '') {
      // keep end as is? clear end?
      // If distance cleared, don't auto clear end; tests expect end to stay until new distance
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStartTime(val);
    if (val && endTime) {
      const dur = calculateDurationMinutes(val, endTime);
      setDuration(formatDurationMinutes(dur));
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndTime(val);
    if (val && startTime) {
      const dur = calculateDurationMinutes(startTime, val);
      setDuration(formatDurationMinutes(dur));
    } else if (val && duration) {
      // if duration exists but start empty, recalc start
      const durMin = parseDurationToMinutes(duration);
      const start = calculateStartTimeFromEndAndDuration(val, durMin);
      setStartTime(start);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDuration(val);
    const durMin = parseDurationToMinutes(val);
    if (endTime) {
      const start = calculateStartTimeFromEndAndDuration(endTime, durMin);
      setStartTime(start);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!placesVisited.trim()) {
      setErrorMessage('Places visited is required.');
      return;
    }
    const sKm = parseFloat(startKm);
    const eKm = parseFloat(endKm);
    const dist = parseFloat(distance);
    if (isNaN(sKm) || isNaN(eKm) || isNaN(dist)) {
      setErrorMessage('Please provide valid odometer values.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setErrorMessage('Please fill date and time fields.');
      return;
    }

    setSaving(true);
    try {
      const fuelAmt = fuelPumped ? parseFloat(fuelPumped) : 0;
      await saveTrip({
        date,
        start_time: startTime,
        end_time: endTime,
        start_km: roundToOneDecimal(sKm),
        end_km: roundToOneDecimal(eKm),
        trip_distance: roundToOneDecimal(dist),
        trip_type: tripType,
        places_visited: placesVisited,
        fuel_pumped_amount: isNaN(fuelAmt) ? 0 : roundToOneDecimal(fuelAmt),
        fuel_order_no: fuelOrderNo,
      });
      setSuccessMessage('Trip saved successfully!');
      // Reset end/distance/places for next entry, keep continuity: new start is previous end
      setStartKm(String(roundToOneDecimal(eKm)));
      setIsAutoStartKm(true);
      setEndKm('');
      setDistance('');
      setPlacesVisited('');
      setFuelPumped('');
      setFuelOrderNo('');
      // Keep times? Reset start/duration but keep end as current time for next
      setStartTime('');
      setDuration('');
      setEndTime(getCurrentTimeString());
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading trip form...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto bg-paper-sheet dark:bg-zinc-900 shadow-xl rounded-xl border border-rule-line dark:border-zinc-800 overflow-hidden">
      <div className="bg-slate-surface text-on-primary px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-telemetry-cyan text-xl">➕</span>
          <div>
            <h2 className="text-base font-bold tracking-tight">Quick Trip Data Entry</h2>
            <p className="text-xs text-on-primary-container">Smart reciprocal calculations • Ledger continuity</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-primary-container text-tertiary-fixed px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
          SEC-24
        </span>
      </div>

      {successMessage && (
        <div className="mx-6 mt-6 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mx-6 mt-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-6">
        {/* Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="trip-date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input
              id="trip-date"
              aria-label="Date"
              type="date"
              value={date}
              onChange={handleDateChange}
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
            <p className="mt-1 text-xs font-semibold text-telemetry-cyan uppercase tracking-wider">
              {dayOfWeek}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Trip Type</label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  value="Official"
                  checked={tripType === 'Official'}
                  onChange={() => setTripType('Official')}
                  className="accent-teal-600"
                />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Official</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">OFF</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  value="Private"
                  checked={tripType === 'Private'}
                  onChange={() => setTripType('Private')}
                  className="accent-amber-600"
                />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Private</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">PRI</span>
              </label>
            </div>
          </div>
        </div>

        {/* Odometer Section */}
        <div className="p-4 bg-paper-ledger dark:bg-zinc-800/50 rounded-xl border border-rule-line dark:border-zinc-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Odometer Reciprocal — Start + Distance = End</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start-km" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Start KM
              </label>
              <input
                id="start-km"
                aria-label="Start KM"
                type="number"
                step="0.1"
                value={startKm}
                onChange={handleStartKmChange}
                required
                className={`w-full px-3 py-2 border rounded-lg font-mono focus:ring-2 focus:outline-none ${
                  isAutoStartKm
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 focus:ring-amber-500'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-cyan-500'
                }`}
              />
              <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isAutoStartKm ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                {isAutoStartKm ? 'Auto-filled from last End KM' : 'Manual override'}
              </span>
            </div>

            <div>
              <label htmlFor="end-km" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                End KM
              </label>
              <input
                id="end-km"
                aria-label="End KM"
                type="number"
                step="0.1"
                value={endKm}
                onChange={handleEndKmChange}
                placeholder="Enter End KM"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="trip-distance" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Trip Distance (KM)
              </label>
              <input
                id="trip-distance"
                aria-label="Trip Distance"
                type="number"
                step="0.1"
                value={distance}
                onChange={handleDistanceChange}
                placeholder="Enter Distance"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            Formula: Distance (1-dec) = End − Start • Rounded to 0.1 KM
          </p>
        </div>

        {/* Time Section */}
        <div className="p-4 bg-paper-ledger dark:bg-zinc-800/50 rounded-xl border border-rule-line dark:border-zinc-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Time Reciprocal — End − Duration = Start</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Start Time
              </label>
              <input
                id="start-time"
                aria-label="Start Time"
                type="time"
                value={startTime}
                onChange={handleStartTimeChange}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                End Time
              </label>
              <input
                id="end-time"
                aria-label="End Time"
                type="time"
                value={endTime}
                onChange={handleEndTimeChange}
                required
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
              <span className="mt-1 inline-block text-[10px] font-semibold text-telemetry-cyan uppercase">defaults to current time</span>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Duration (HH:MM)
              </label>
              <input
                id="duration"
                aria-label="Duration"
                type="text"
                placeholder="00:55"
                value={duration}
                onChange={handleDurationChange}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
              <span className="mt-1 inline-block text-[10px] text-zinc-500 uppercase tracking-wider">Enter Duration to compute Start</span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            Formula: Start = End − Duration • Supports overnight wrap
          </p>
        </div>

        {/* Places & Fuel */}
        <div className="space-y-4">
          <div>
            <label htmlFor="places-visited" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Places Visited / Route & Purpose <span className="text-red-500">*</span>
            </label>
            <input
              id="places-visited"
              aria-label="Places Visited"
              type="text"
              value={placesVisited}
              onChange={(e) => setPlacesVisited(e.target.value)}
              placeholder="e.g., HQ Fleet Yard → Regional Port Customs"
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fuel-pumped" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Fuel Pumped (L) <span className="text-zinc-400 font-normal text-xs">Optional</span>
              </label>
              <input
                id="fuel-pumped"
                aria-label="Fuel Pumped"
                type="number"
                step="0.1"
                value={fuelPumped}
                onChange={(e) => setFuelPumped(e.target.value)}
                placeholder="e.g., 35.0"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="fuel-order-no" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Fuel Order No <span className="text-zinc-400 font-normal text-xs">Optional</span>
              </label>
              <input
                id="fuel-order-no"
                aria-label="Fuel Order No"
                type="text"
                value={fuelOrderNo}
                onChange={(e) => setFuelOrderNo(e.target.value)}
                placeholder="e.g., #FO-88912"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
              <span className="mt-1 inline-block text-[10px] text-zinc-500 uppercase">Fuel Order Date = Trip Date</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-rule-line dark:border-zinc-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-slate-surface hover:bg-primary text-on-primary font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Trip'}
          </button>
        </div>
      </form>
    </div>
  );
}
