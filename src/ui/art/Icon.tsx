import { ICON_PATHS as P } from './paths';

// Icons from the shared set, stroked in currentColor.



export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const d = P[name] ?? P.info!;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
