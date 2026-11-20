"use client";

import { useApp } from "@/lib/context";
import { Select } from "./ui";

/** Locations selectable on single-location pages: allowed + vertical/board filters (not narrowed by the School filter). */
function useSelectable() {
  const { allowedLocations, vertical, board } = useApp();
  const list = allowedLocations.filter((l) => (vertical === "All" || l.vertical === vertical) && (board === "All" || l.board === board));
  return list.length ? list : allowedLocations;
}

/** Page-level school picker for single-school pages. Hidden when a school is already chosen in Global Filters. */
export function LocationPicker() {
  const { locationId, setLocationId, lockedLocation, school } = useApp();
  const list = useSelectable();
  if (school !== "all" || lockedLocation) return null;
  const current = list.some((l) => l.id === locationId) ? locationId : list[0].id;
  return (
    <Select
      label="School"
      value={current}
      disabled={lockedLocation}
      onChange={setLocationId}
      options={list.map((l) => ({ value: l.id, label: l.short, hint: l.board }))}
    />
  );
}

/** Resolves the effective single location (the global School filter wins when set). */
export function useCurrentLocation() {
  const { locationId, school } = useApp();
  const list = useSelectable();
  return list.find((l) => l.id === (school !== "all" ? school : locationId)) ?? list.find((l) => l.id === locationId) ?? list[0];
}
