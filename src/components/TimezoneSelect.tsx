"use client";

import { useEffect, useState } from "react";

type Option = { value: string; label: string };

const OPTIONS: Option[] = [
  { value: "America/New_York", label: "Eastern (New York / Miami)" },
  { value: "America/Chicago", label: "Central (Chicago / Houston)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles / Seattle)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Tijuana", label: "Tijuana" },
  { value: "America/Havana", label: "La Habana" },
  { value: "America/San_Juan", label: "San Juan" },
  { value: "America/Bogota", label: "Bogotá / Lima / Quito" },
  { value: "America/Caracas", label: "Caracas" },
  { value: "America/Santiago", label: "Santiago" },
  { value: "America/Buenos_Aires", label: "Buenos Aires / Montevideo" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Atlantic/Canary", label: "Islas Canarias" },
  { value: "Europe/Madrid", label: "Madrid / Barcelona" },
  { value: "Europe/London", label: "London" },
  { value: "UTC", label: "UTC" },
];

function detect(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function TimezoneSelect({
  defaultValue,
  name = "timezone",
}: {
  defaultValue?: string | null;
  name?: string;
}) {
  const [value, setValue] = useState(
    defaultValue && OPTIONS.some((o) => o.value === defaultValue)
      ? defaultValue
      : "America/New_York",
  );

  useEffect(() => {
    if (defaultValue) return;
    const detected = detect();
    if (detected && OPTIONS.some((o) => o.value === detected)) {
      setValue(detected);
    }
  }, [defaultValue]);

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 focus:outline-none focus:border-warm-200 transition-colors w-full sm:w-auto"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-soft">
          {o.label}
        </option>
      ))}
    </select>
  );
}
