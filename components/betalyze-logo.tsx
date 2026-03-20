interface BetalyzeLogoProps {
  height?: number;
  className?: string;
}

export function BetalyzeLogo({ height = 30, className }: BetalyzeLogoProps) {
  // SVG aspect ratio: 512 × 128 (4:1)
  const width = Math.round(height * 4);

  return (
    <img
      src="/betalyze-logo.svg"
      alt="Betalyze"
      height={height}
      width={width}
      className={className}
      style={{ userSelect: "none" }}
    />
  );
}
