import { useEffect, type RefObject } from "react";

/** Calls `onOutside` on any mousedown outside of `ref`'s element - e.g. to close a dropdown. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void): void {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onOutside]);
}
