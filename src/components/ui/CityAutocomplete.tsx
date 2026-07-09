"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ISRAEL_CITIES } from "@/lib/cities";
import { cn } from "@/lib/cn";

const MAX_SUGGESTIONS = 30;

/**
 * Hebrew-searchable city picker, backed by the full ~1,180-locality
 * dataset in `israelLocalities.ts` (too many to browse in a plain
 * `<select>` comfortably). Submits via a hidden input under `name` so
 * existing Server Actions that read `formData.get("city")` need no
 * changes - the visible text field is purely for search/display, and only
 * ever commits a value that's an exact match in `ISRAEL_CITIES` (the
 * server action's own `ISRAEL_CITIES.includes(city)` check is still the
 * real validation boundary, this is just a client-side nicety).
 */
export function CityAutocomplete({
  id,
  name,
  defaultValue = "",
  required,
  placeholder = "הקלידו לחיפוש עיר...",
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [selected, setSelected] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return ISRAEL_CITIES.filter((city) => city.includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        // Revert visible text to the last real selection if the user typed
        // something and clicked away without picking a suggestion.
        setQuery(selected);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  function selectCity(city: string) {
    setSelected(city);
    setQuery(city);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selected} required={required} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected("");
          setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => {
          if (query) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            selectCity(matches[highlightIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-base text-foreground placeholder:text-foreground/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />

      {open && matches.length > 0 && (
        <ul id={listboxId} className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg">
          {matches.map((city, index) => (
            <li key={city}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCity(city)}
                className={cn(
                  "block w-full px-4 py-2 text-right text-sm transition",
                  index === highlightIndex ? "bg-brand/10 text-brand-dark" : "hover:bg-black/5"
                )}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && matches.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-foreground/50 shadow-lg">
          לא נמצאה עיר מתאימה
        </div>
      )}
    </div>
  );
}
