import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function DropIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.2c3.5 4.1 5.8 6.9 5.8 9.7a5.8 5.8 0 0 1-11.6 0c0-2.8 2.3-5.6 5.8-9.7Z" />
      <path d="M9.4 13.1a2.6 2.6 0 0 0 2.4 3.2" />
    </svg>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5V6.8c0-.7.6-1.3 1.3-1.3h13.4c.7 0 1.3.6 1.3 1.3v2.7" />
      <path d="M3 9.5h18v3.2H3z" />
      <path d="M5 12.7v6.5h14v-6.5" />
      <path d="M8.5 15.2h7v4h-7z" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 16.5v2.2c0 .7.6 1.3 1.3 1.3h13.4c.7 0 1.3-.6 1.3-1.3v-2.2" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 11a8 8 0 1 0-.6 4.4" />
      <path d="M20 5.5V11h-5.4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m12 4 8 4.2-8 4.2-8-4.2L12 4Z" />
      <path d="m4 12.2 8 4.2 8-4.2" />
      <path d="m4 16.1 8 4.2 8-4.2" />
    </svg>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 13.8V6a2 2 0 1 1 4 0v7.8a4 4 0 1 1-4 0Z" />
      <path d="M12 9.5v6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5 21 20H3L12 4.5Z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 5H6.5c-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5H14" />
      <path d="M17 8.5 20.5 12 17 15.5M20 12h-9" />
    </svg>
  );
}

export function SpoolIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5v5M12 14.5v5M4.5 12h5M14.5 12h5" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7.5c0-.8.7-1.5 1.5-1.5h4l2 2h7c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5v-10Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />
    </svg>
  );
}
