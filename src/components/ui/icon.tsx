import type { SVGProps } from "react"

import type { IconName } from "@/interfaces/common"
import { cn } from "@/utils/cn"

const paths: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M8 3v3.5M16 3v3.5M3 10h18" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 6H21M8.5 12H21M8.5 18H21" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 16-4.5-4.5L5 23" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <circle cx="16.5" cy="14.5" r="1.1" />
    </>
  ),
  "badge-check": (
    <>
      <path d="M12 3.2l2.2 1.5 2.6-.2.9 2.5 2.2 1.4-.8 2.5.8 2.5-2.2 1.4-.9 2.5-2.6-.2L12 20.4l-2.2-1.5-2.6.2-.9-2.5-2.2-1.4.8-2.5-.8-2.5 2.2-1.4.9-2.5 2.6.2Z" />
      <path d="m9.2 12 2 2 4-4" />
    </>
  ),
  star: <path d="M12 3.5l2.7 5.2 5.8.9-4.2 4.1 1 5.8L12 16.8 6.7 19.5l1-5.8-4.2-4.1 5.8-.9Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  "arrow-up": (
    <>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.5h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.4 4.3" />
      <path d="M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a10.9 10.9 0 0 0 4.3-.9" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  phone: (
    <path d="M4 4h4l2 5-2.4 1.4a12 12 0 0 0 5.6 5.6L14.5 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 3 5.1 1 1 0 0 1 4 4Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5l1.7 4.4L18 9.6l-4.3 1.7L12 15.7l-1.7-4.4L6 9.6l4.3-1.7Z" />
      <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    </>
  ),
  droplet: <path d="M12 3.5s6 6.2 6 10.8a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5Z" />,
  brush: (
    <>
      <path d="M15.5 4 4.5 15l4.5 4.5L20 8.5Z" />
      <path d="m13.5 6 4.5 4.5" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6.5 15h4" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 9.4c0-2.3 1-3.9 3-3.9 1.6 0 2.6 1.3 2.6 2.9 0 2-1.7 3.2-4 3.4" />
      <path d="M14.6 12c2.3 0 3.9 1 3.9 3 0 1.6-1.3 2.6-2.9 2.6-2 0-3.2-1.7-3.4-4" />
      <path d="M12 14.6c0 2.3-1 3.9-3 3.9-1.6 0-2.6-1.3-2.6-2.9 0-2 1.7-3.2 4-3.4" />
      <path d="M9.4 12c-2.3 0-3.9-1-3.9-3 0-1.6 1.3-2.6 2.9-2.6 2 0 3.2 1.7 3.4 4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.1Z" />
      <path d="m9.2 12 2 2 4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13.5 6 9.5Z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </>
  ),
  apple: (
    <>
      <path
        fill="currentColor"
        stroke="none"
        d="M17.05 12.54c-.03-2.47 2.02-3.65 2.11-3.71-1.15-1.68-2.94-1.91-3.58-1.94-1.52-.15-2.97.9-3.74.9-.77 0-1.96-.88-3.22-.85-1.66.02-3.19.96-4.04 2.44-1.72 2.99-.44 7.42 1.24 9.85.82 1.19 1.8 2.52 3.08 2.47 1.24-.05 1.71-.8 3.2-.8 1.49 0 1.91.8 3.22.78 1.33-.02 2.17-1.21 2.98-2.4.94-1.38 1.33-2.72 1.35-2.79-.03-.01-2.59-1-2.6-3.95Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M14.6 4.9c.68-.83 1.14-1.98 1.01-3.12-.98.04-2.17.65-2.87 1.48-.63.73-1.19 1.9-1.04 3.02 1.1.08 2.22-.55 2.9-1.38Z"
      />
    </>
  ),
  play: (
    <path
      fill="currentColor"
      stroke="none"
      d="M7 4.4v15.2c0 .7.76 1.12 1.35.77l12.1-7.6a.9.9 0 0 0 0-1.54L8.35 3.63A.9.9 0 0 0 7 4.4Z"
    />
  ),
  heart: (
    <>
      <path d="M12 20.4c-.35 0-.69-.14-.94-.38C6.6 15.9 3.6 13.05 3.6 9.6 3.6 6.85 5.77 4.6 8.43 4.6c1.37 0 2.68.61 3.57 1.68a4.62 4.62 0 0 1 3.57-1.68c2.66 0 4.83 2.25 4.83 5 0 3.45-3 6.3-7.46 10.42a1.3 1.3 0 0 1-.94.38Z" />
      <path d="M8.8 8.9a1.7 1.7 0 0 0-1.6 1" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5Z" />
      <path d="M9 3.5v14M15 6v14" />
    </>
  ),
  navigation: (
    <>
      <path d="m3 11 19-8-8 19-2.5-8.5Z" />
      <path d="m21 3-8.5 18.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.4a6.2 6.2 0 0 1 3.7 5.6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M6 18 18 6M9 6h9v9" />
    </>
  ),
}

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
}

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-5", className)}
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
