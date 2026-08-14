import { cn } from "@/lib/utils";

export type ComposerIconState = "idle" | "send";

const LOGO_SRC = "/helper-mark.png";

/**
 * Structural pieces (matched to Helper mark geometry):
 * - OUTER: largest caret / A shell → becomes arrowhead
 * - RIBS: three inner diagonals → collapse into vertical shaft
 */
const OUTER = {
  idle: "M8.2 23.5 C9.5 16.5 13.0 10.2 16.5 6.8 C18.9 9.8 21.4 14.0 23.0 17.4",
  send: "M8.8 16.6 C11.2 14.0 13.6 11.2 16.0 8.8 C18.4 11.2 20.8 14.0 23.2 16.6",
} as const;

const RIBS = [
  {
    idle: "M11.2 22.6 C12.8 17.0 15.6 12.2 18.0 9.5",
    send: "M16 23.0 C16 20.5 16 18.0 16 15.5",
  },
  {
    idle: "M13.4 21.6 C14.8 16.6 17.2 12.6 19.2 10.3",
    send: "M16 18.5 C16 16.2 16 14.0 16 11.8",
  },
  {
    idle: "M15.4 20.4 C16.4 16.0 18.0 12.8 19.8 11.0",
    send: "M16 14.2 C16 12.4 16 10.6 16 9.0",
  },
] as const;

function MorphGlyph({ send }: { send: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-5 overflow-visible text-[#A5D7F4]"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="composer-morph-stroke composer-morph-stroke--outer"
        d={send ? OUTER.send : OUTER.idle}
      />
      {RIBS.map((rib, index) => (
        <path
          key={index}
          className="composer-morph-stroke composer-morph-stroke--rib"
          d={send ? rib.send : rib.idle}
        />
      ))}
    </svg>
  );
}

/**
 * Idle = exact Helper mark. Typing crossfades to the send glyph via opacity
 * only — this control is hit on every keystroke.
 */
export function ComposerActionIcon({
  state,
  className,
}: {
  state: ComposerIconState;
  className?: string;
}) {
  const send = state === "send";

  return (
    <span
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-150 ease-in-out",
          send ? "opacity-0" : "opacity-100",
        )}
      />

      <span
        className={cn(
          "relative z-[1] flex items-center justify-center transition-opacity duration-150 ease-in-out",
          send ? "opacity-100" : "opacity-0",
        )}
      >
        <MorphGlyph send={send} />
      </span>
    </span>
  );
}
