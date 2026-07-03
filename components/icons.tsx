// Hand-drawn chunky pixel-grid icons (SVG rects on a 10x10 lattice) so the
// tool/zoom/action buttons match the "pixel workshop" aesthetic instead of
// generic smooth-path icon-font glyphs. Presentation only — no app logic.

interface PixelIconProps {
  className?: string;
}

function PixelIcon({ pattern, className }: { pattern: string[]; className?: string }) {
  const size = pattern.length;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`pixel-icon ${className ?? ""}`} aria-hidden="true" focusable="false">
      {pattern.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null))
      )}
    </svg>
  );
}

export function BrushIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        ".......##.",
        "......##..",
        ".....##...",
        "....###...",
        "...###....",
        "..###.....",
        ".###......",
        "###.......",
        "##........",
        "#.........",
      ]}
    />
  );
}

export function PanIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "....##....",
        "...####...",
        "..######..",
        "....##....",
        "..########",
        "..########",
        "....##....",
        "..######..",
        "...####...",
        "....##....",
      ]}
    />
  );
}

export function ZoomInIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "##########",
        "#........#",
        "#...##...#",
        "#...##...#",
        "#.######.#",
        "#.######.#",
        "#...##...#",
        "#...##...#",
        "#........#",
        "##########",
      ]}
    />
  );
}

export function ZoomOutIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "##########",
        "#........#",
        "#........#",
        "#........#",
        "#.######.#",
        "#.######.#",
        "#........#",
        "#........#",
        "#........#",
        "##########",
      ]}
    />
  );
}

export function DownloadIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "....##....",
        "....##....",
        "....##....",
        "...####...",
        "..######..",
        "....##....",
        "....##....",
        "#........#",
        "#........#",
        "##########",
      ]}
    />
  );
}

export function TrashIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "..######..",
        ".#......#.",
        "##########",
        ".#.##.##.#",
        ".#.##.##.#",
        ".#.##.##.#",
        ".#.##.##.#",
        ".#.##.##.#",
        ".#......#.",
        "..######..",
      ]}
    />
  );
}

export function FlameIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "....##....",
        "...####...",
        "..######..",
        ".###..###.",
        ".##....##.",
        ".##....##.",
        "..##..##..",
        "...####...",
        "....##....",
        "...####...",
      ]}
    />
  );
}

export function CopyIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        ".#######..",
        ".#.....#..",
        "##.....##.",
        "#.......#.",
        "#.......#.",
        "#.......#.",
        "#.......#.",
        "#.......#.",
        "##########",
        "..........",
      ]}
    />
  );
}

export function CheckIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        "..........",
        ".........#",
        "........##",
        "#......##.",
        "##....##..",
        ".##..##...",
        "..####....",
        "...##.....",
        "..........",
        "..........",
      ]}
    />
  );
}

export function DoorIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        ".########.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#.....##.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".#......#.",
        ".########.",
      ]}
    />
  );
}

export function LinkIcon({ className }: PixelIconProps) {
  return (
    <PixelIcon
      className={className}
      pattern={[
        ".##..##...",
        "#..##..#..",
        "#..##..#..",
        ".##..##...",
        "....##....",
        "....##....",
        ".##..##...",
        "#..##..#..",
        "#..##..#..",
        ".##..##...",
      ]}
    />
  );
}
