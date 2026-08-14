"use client";

import { useEffect, useRef, useState } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import { cn } from "@/lib/utils";

export type ComposerIconState = "idle" | "send";

const STATE_MACHINE = "Composer";
const RIVE_SRC = "/rive/composer-send.riv";
const LOGO_SRC = "/helper-mark.png";

/**
 * Structural pieces (matched to Helper mark geometry):
 * - OUTER: largest caret / A shell → becomes arrowhead
 * - RIBS: three inner diagonals → collapse into vertical shaft
 *
 * Paths are set via the SVG `d` attribute (not CSS `d: path()`),
 * which Safari / iOS Chrome do not support — that left a blank circle.
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
      className={cn(
        "size-5 overflow-visible text-[#A5D7F4] transition-transform duration-200 ease-out",
        send ? "scale-100" : "scale-90",
      )}
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

function BrandMorphIcon({
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
      {/* Exact brand artwork for idle */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-150 ease-out",
          send ? "opacity-0" : "opacity-100",
        )}
      />

      <span
        className={cn(
          "relative z-[1] flex items-center justify-center transition-opacity duration-150 ease-out",
          send ? "opacity-100" : "opacity-0",
        )}
      >
        <MorphGlyph send={send} />
      </span>
    </span>
  );
}

function RiveMorphIcon({
  state,
  className,
  onUnavailable,
}: {
  state: ComposerIconState;
  className?: string;
  onUnavailable?: () => void;
}) {
  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    onLoadError: () => onUnavailable?.(),
  });

  const sendInput = useStateMachineInput(rive, STATE_MACHINE, "send");

  useEffect(() => {
    if (!sendInput) return;
    sendInput.value = state === "send";
  }, [sendInput, state]);

  return (
    <RiveComponent
      className={cn("size-full rounded-full", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Idle = exact Helper mark. Typing swaps to send arrow via SVG `d` + fade
 * (CSS path morph is unsupported on Safari / many mobile browsers).
 */
export function ComposerActionIcon({
  state,
  className,
}: {
  state: ComposerIconState;
  className?: string;
}) {
  const probed = useRef(false);
  const [riveAvailable, setRiveAvailable] = useState(false);

  useEffect(() => {
    if (probed.current) return;
    probed.current = true;
    let cancelled = false;
    fetch(RIVE_SRC, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setRiveAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setRiveAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (riveAvailable) {
    return (
      <RiveMorphIcon
        state={state}
        className={className}
        onUnavailable={() => setRiveAvailable(false)}
      />
    );
  }

  return <BrandMorphIcon state={state} className={className} />;
}
