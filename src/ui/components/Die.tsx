const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DieFace({
  value,
  className = '',
  onClick,
  label,
  children,
}: {
  value: number;
  className?: string;
  onClick?: () => void;
  label?: string;
  children?: React.ReactNode;
}) {
  const on = new Set(PIPS[value] ?? []);
  const inner = (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={on.has(i) ? 'on' : ''} />
      ))}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`die ${className}`} onClick={onClick} aria-label={label ?? `Die showing ${value}`}>
        {inner}
      </button>
    );
  }
  return (
    <span className={`die ${className}`} role="img" aria-label={label ?? `Die showing ${value}`}>
      {inner}
    </span>
  );
}
