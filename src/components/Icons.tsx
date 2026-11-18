/**
 * ConoBot icon system - original, hand-drawn SVG geometry.
 *
 * House rules:
 *  - 24x24 grid, 1.75px stroke, round caps/joins.
 *  - Primary geometry inherits `currentColor`.
 *  - Secondary "energy" paths use the mint accent (`var(--accent)`) at reduced
 *    opacity for the dual-tone look.
 *  - Nothing here is traced from or derived from a third-party logo.
 */
import clsx from "clsx";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  /** Pixel size (square). Defaults to 18. */
  size?: number;
  /** Stroke weight. The house default is 1.75. */
  strokeWidth?: number;
  /** Colour for the secondary accent paths. */
  accent?: string;
};

function Icon({
  size = 18,
  strokeWidth = 1.75,
  accent = "var(--accent)",
  className,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={clsx("shrink-0", className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Brand                                                             */
/* ------------------------------------------------------------------ */

/** App logo: a geometric visor emblem with a sensor node and antenna. */
export function BrandMark({ size = 22, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="2.75" y="7.25" width="18.5" height="12" rx="4.25" />
      <path d="M12 7.25V4.9" />
      <circle cx="12" cy="3.4" r="1.15" fill="var(--accent)" stroke="var(--accent)" />
      <path
        d="M6.9 12.2h3.05M14.05 12.2h3.05"
        stroke="var(--accent)"
        strokeWidth="2.4"
        opacity="0.95"
      />
      <path d="M9 15.9h6" opacity="0.55" />
      <circle cx="5.2" cy="9.9" r="0.7" fill="var(--accent)" stroke="none" />
      <circle cx="18.8" cy="9.9" r="0.7" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

/** Compact glyph used in tight spaces (sidebar rail, tray-adjacent UI). */
export function BrandGlyph({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3.5" y="8.5" width="17" height="10.5" rx="3.6" />
      <path d="M12 8.5V5.4" />
      <circle cx="12" cy="3.9" r="1.05" fill="var(--accent)" stroke="var(--accent)" />
      <path d="M7.6 13.2h2.7M13.7 13.2h2.7" stroke="var(--accent)" strokeWidth="2.3" />
    </Icon>
  );
}

/* ------------------------------------------------------------------ */
/*  Providers                                                         */
/* ------------------------------------------------------------------ */

/** Ollama — a local runtime core wrapped in an orbit. */
export function ProviderOllama({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4.25" y="5.5" width="15.5" height="13" rx="4" />
      <path d="M8.6 10.4 6.9 12l1.7 1.6" stroke="var(--accent)" />
      <path d="M15.4 10.4 17.1 12l-1.7 1.6" stroke="var(--accent)" />
      <path d="M10.9 14.1h2.2" opacity="0.6" />
      <path d="M2.6 12c0-2.6 1.5-4.9 3.7-6" opacity="0.4" />
      <path d="M21.4 12c0 2.6-1.5 4.9-3.7 6" opacity="0.4" />
    </Icon>
  );
}

/** LM Studio — stacked workspace planes with a run node. */
export function ProviderLMStudio({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3.4" y="6.2" width="13.4" height="10.4" rx="3.2" />
      <path d="M16.8 8.6h2.2a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H7.4a1.6 1.6 0 0 1-1.6-1.6v-1.6" opacity="0.45" />
      <path d="M7.9 9.4h3.4M7.9 12.1h5.6" opacity="0.55" />
      <path d="M9.9 14.5l2.4-0.1 2.2-1.9-2.2-1.9-2.4-.1z" stroke="var(--accent)" />
    </Icon>
  );
}

/** Claude — a calibration burst inside a rounded hex frame. */
export function ProviderClaude({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M8.6 3.9h6.8l4.35 7.6-3.4 7.6H7.65L4.25 11.5z" opacity="0.85" />
      <path d="M12 6.7v10.6M7.4 9.4l9.2 5.2M16.6 9.4l-9.2 5.2" stroke="var(--accent)" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

/** Custom OpenAI-compatible / cloud endpoint. */
export function ProviderCloud({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M7.4 18.2h9.9a3.7 3.7 0 0 0 .5-7.36 5.4 5.4 0 0 0-10.35-1.1A4.05 4.05 0 0 0 7.4 18.2Z" />
      <path d="M9.2 14.5h5.6" opacity="0.45" />
      <circle cx="12" cy="12.3" r="1.4" fill="var(--accent)" stroke="var(--accent)" />
    </Icon>
  );
}

/** Anthropic-style keyed endpoint (used for "API key configured"). */
export function ProviderKey({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="8.4" cy="12" r="3.5" />
      <path d="M11.9 12h8.2M17.2 12v3.1M19.9 12v2.2" />
      <circle cx="8.4" cy="12" r="1.1" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export const PROVIDER_ICONS = {
  ollama: ProviderOllama,
  lmstudio: ProviderLMStudio,
  anthropic: ProviderClaude,
  openai: ProviderCloud,
} as const;

/* ------------------------------------------------------------------ */
/*  Thinking / streaming                                              */
/* ------------------------------------------------------------------ */

/** Orbiting node — the "agent is thinking" mark. */
export function ThinkingPulse({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8" opacity="0.22" />
      <g className="animate-orbit" style={{ transformOrigin: "12px 12px" }}>
        <circle cx="12" cy="4" r="2.1" fill="var(--accent)" stroke="var(--accent)" />
      </g>
      <circle cx="12" cy="12" r="3.1" stroke="var(--accent)" />
      <path d="M12 7.4v1.5M12 15.1v1.5" opacity="0.4" />
    </Icon>
  );
}

/** Three-bar stream meter (used next to a generating message). */
export function StreamPulse({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={clsx("shrink-0", className)}
      {...props}
    >
      <rect x="1.6" y="6" width="2.2" height="4" rx="1.1" fill="currentColor" opacity="0.45" />
      <rect x="6.9" y="3" width="2.2" height="10" rx="1.1" fill="var(--accent)" />
      <rect x="12.2" y="5" width="2.2" height="6" rx="1.1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop / workspace controls                                      */
/* ------------------------------------------------------------------ */

export function NewChat({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M20.2 12.4a7.7 7.7 0 0 1-8.1 7.7 8.4 8.4 0 0 1-3.1-.5L4.2 20.4l.9-4.6a7.6 7.6 0 0 1-.9-3.6 7.7 7.7 0 0 1 7.9-7.7 7.7 7.7 0 0 1 8.1 7.7Z" />
      <path d="M12 8.5v6.4M8.8 11.7h6.4" stroke="var(--accent)" />
    </Icon>
  );
}

export function Settings({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4 7.4h6.1M15.4 7.4h4.6M4 16.6h4.4M13.9 16.6H20" opacity="0.85" />
      <circle cx="13" cy="7.4" r="2.4" />
      <circle cx="11.2" cy="16.6" r="2.4" stroke="var(--accent)" />
    </Icon>
  );
}

/** Collapsible code / artifact panel toggle. */
export function CodePanel({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3.1" y="4.4" width="17.8" height="15.2" rx="3.1" />
      <path d="M13.6 4.4v15.2" opacity="0.9" />
      <path d="M6.5 9.1 8.6 11l-2.1 1.9M10.3 13.6l1.1-4.4" stroke="var(--accent)" />
      <path d="M15.8 9.6h2.4M15.8 12.4h1.7" opacity="0.5" />
    </Icon>
  );
}

export function SaveFile({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M5.4 3.8h8.4l4.8 4.8v11.6H5.4z" />
      <path d="M13.7 3.9v4.7h4.7" opacity="0.6" />
      <path d="M9.2 18.2v-4.1M7.2 16.1l2-2 2 2" stroke="var(--accent)" />
    </Icon>
  );
}

export function Send({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M20.2 4.1 3.9 10.5l6.1 2.2 2.2 6.1z" />
      <path d="M20.2 4.1 10 12.7" stroke="var(--accent)" />
    </Icon>
  );
}

export function Stop({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.6" fill="currentColor" fillOpacity="0.14" />
      <rect x="9.1" y="9.1" width="5.8" height="5.8" rx="1.4" stroke="var(--accent)" fill="var(--accent)" fillOpacity="0.28" />
    </Icon>
  );
}

export function Copy({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="8.6" y="8.6" width="11.6" height="11.6" rx="2.6" />
      <path d="M15.4 5.8V5.4a2 2 0 0 0-2-2H5.8a2 2 0 0 0-2 2v7.6a2 2 0 0 0 2 2h.4" opacity="0.55" />
      <path d="M12.4 12.6h4M14.4 10.6v4" stroke="var(--accent)" opacity="0.7" />
    </Icon>
  );
}

export function Check({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4.8 12.6 9.4 17 19.2 6.9" stroke="var(--accent)" strokeWidth="2" />
    </Icon>
  );
}

export function Delete({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4.8 6.9h14.4M9.4 6.9V4.6h5.2v2.3" />
      <path d="M6.6 6.9l.9 12.4a1.7 1.7 0 0 0 1.7 1.6h5.6a1.7 1.7 0 0 0 1.7-1.6l.9-12.4" />
      <path d="M10.4 10.6v6.6M13.6 10.6v6.6" opacity="0.5" />
      <path d="M6.9 6.9h10.2" stroke="var(--ember-400)" opacity="0.45" />
    </Icon>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation & status                                               */
/* ------------------------------------------------------------------ */

export function ChevronDown({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="m6.4 9.4 5.6 5.4 5.6-5.4" />
    </Icon>
  );
}

export function ChevronRight({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="m9.4 6.4 5.4 5.6-5.4 5.6" />
    </Icon>
  );
}

export function SidebarToggle({ size = 18, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3.2" />
      <path d="M9.4 4.6v14.8" opacity="0.9" />
      <path d="M5.3 9.2h1.8M5.3 12h1.8M5.3 14.8h1.8" stroke="var(--accent)" opacity="0.85" />
    </Icon>
  );
}

export function Search({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="10.9" cy="10.9" r="6.2" />
      <path d="m15.5 15.5 4.2 4.2" />
      <path d="M8.4 10.9h5" stroke="var(--accent)" opacity="0.6" />
    </Icon>
  );
}

export function Folder({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M3.4 7.1a2.2 2.2 0 0 1 2.2-2.2h3.3l2 2.3h7.5a2.2 2.2 0 0 1 2.2 2.2v7.9a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M3.6 10.4h16.8" opacity="0.4" />
      <circle cx="6.6" cy="13.4" r="0.8" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export function Plus({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 5.2v13.6M5.2 12h13.6" />
    </Icon>
  );
}

export function Close({ size = 14, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="m6.2 6.2 11.6 11.6M17.8 6.2 6.2 17.8" />
    </Icon>
  );
}

export function Alert({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3.9 21.1 19.6H2.9z" />
      <path d="M12 9.2v4.4" stroke="var(--ember-400)" strokeWidth="2" />
      <circle cx="12" cy="16.6" r="0.95" fill="var(--ember-400)" stroke="none" />
    </Icon>
  );
}

export function Info({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.1" />
      <circle cx="12" cy="7.9" r="0.95" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export function Sparkles({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3.6 13.6 9l5.4 1.6-5.4 1.6L12 17.6l-1.6-5.4L5 10.6 10.4 9z" />
      <path d="M18.4 15.4l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" stroke="var(--accent)" opacity="0.8" />
    </Icon>
  );
}

export function Refresh({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M20.1 11.4a8.2 8.2 0 1 1-2.6-5.4" />
      <path d="M20.6 3.9v4.6h-4.6" stroke="var(--accent)" />
    </Icon>
  );
}

export function Play({ size = 14, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M8.2 5.4 18.4 12 8.2 18.6z" />
    </Icon>
  );
}

export function Download({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3.9v10.4M7.8 10.4 12 14.6l4.2-4.2" />
      <path d="M4.6 17.2v1.1a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-1.1" stroke="var(--accent)" />
    </Icon>
  );
}

export function Terminal({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3.2" />
      <path d="m7.6 9.4 2.7 2.6-2.7 2.6M12.9 14.8h3.7" stroke="var(--accent)" />
    </Icon>
  );
}

export function Key({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="8.2" cy="12" r="3.9" />
      <path d="M12.1 12h8.1M17.4 12v3.2M20 12v2.3" />
      <circle cx="8.2" cy="12" r="1.2" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export function Globe({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M3.6 12h16.8M12 3.3c2.4 2.3 3.6 5.4 3.6 8.7s-1.2 6.4-3.6 8.7c-2.4-2.3-3.6-5.4-3.6-8.7S9.6 5.6 12 3.3Z" opacity="0.6" />
      <circle cx="16.4" cy="8" r="1" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export function Lock({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5.4" y="10.2" width="13.2" height="9.4" rx="2.6" />
      <path d="M8.4 10.2V8.1a3.6 3.6 0 0 1 7.2 0v2.1" />
      <circle cx="12" cy="14.9" r="1.2" fill="var(--accent)" stroke="none" />
    </Icon>
  );
}

export function ExternalLink({ size = 15, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M13.6 4.4h6v6M19.2 4.8l-7.6 7.6" />
      <path d="M18.4 14.2v4a2 2 0 0 1-2 2H4.9a2 2 0 0 1-2-2V6.7a2 2 0 0 1 2-2h4" opacity="0.65" />
    </Icon>
  );
}

export function FileCode({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M5.6 3.8h8.3l4.6 4.7v11.7H5.6z" />
      <path d="M13.8 3.9v4.6h4.6" opacity="0.55" />
      <path d="m9.6 13.1-1.7 1.7 1.7 1.7M14.4 13.1l1.7 1.7-1.7 1.7" stroke="var(--accent)" />
    </Icon>
  );
}

export function Pencil({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M16.4 4.2 20 7.8 8.9 18.9H5.2v-3.7z" />
      <path d="m14.3 6.3 3.6 3.6" stroke="var(--accent)" />
    </Icon>
  );
}

export function Bulb({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M9.2 17.6a6.6 6.6 0 1 1 5.6 0v1.9a1.7 1.7 0 0 1-1.7 1.7h-2.2a1.7 1.7 0 0 1-1.7-1.7z" />
      <path d="M9.8 20.4h4.4" opacity="0.5" />
      <path d="M12 6.6v4.2M10.2 8.4h3.6" stroke="var(--accent)" />
    </Icon>
  );
}

/** Preference sliders — three calibrated rails with glowing handles. */
export function Sliders({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4 7.2h5.1M13.3 7.2h6.7M4 16.8h8.1M16.3 16.8h3.7" opacity="0.75" />
      <circle cx="11.2" cy="7.2" r="2.1" stroke="var(--accent)" />
      <circle cx="14.2" cy="16.8" r="2.1" />
    </Icon>
  );
}

/* ------------------------------------------------------------------ */
/*  Window chrome                                                     */
/* ------------------------------------------------------------------ */

export function WindowMinimize({ size = 12, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function WindowMaximize({ size = 12, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5.6" y="5.6" width="12.8" height="12.8" rx="2" />
    </Icon>
  );
}

export function WindowRestore({ size = 12, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4.4" y="7.6" width="11" height="11" rx="1.8" />
      <path d="M8.2 7.6V5.9a1.6 1.6 0 0 1 1.6-1.6h8a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6h-1.7" opacity="0.6" />
    </Icon>
  );
}
