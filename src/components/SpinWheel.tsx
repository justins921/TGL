import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const DEFAULT_COLORS = [
  '#15803d',  // forest green
  '#0e7490',  // teal
  '#b45309',  // amber
  '#7c3aed',  // purple
  '#0284c7',  // sky blue
  '#dc2626',  // red
  '#ca8a04',  // dark gold
  '#059669',  // emerald
  '#9333ea',  // violet
  '#ea580c',  // orange
];

interface SpinWheelProps {
  segments: string[];
  onResult: (segment: string) => void;
  title: string;
  colors?: string[];
}

export default function SpinWheel({ segments, onResult, title, colors }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timerRef = useRef<number>(0);

  const n = segments.length;
  const segAngle = n > 0 ? 360 / n : 360;
  const palette = colors || DEFAULT_COLORS;

  // Clear result when segments change
  const segKey = useMemo(() => segments.join('\0'), [segments]);
  useEffect(() => {
    setResult(null);
  }, [segKey]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = SIZE / 2 - 8;

  const handleSpin = useCallback(() => {
    if (spinning || n === 0) return;
    setSpinning(true);
    setResult(null);

    const targetIdx = Math.floor(Math.random() * n);
    const winner = segments[targetIdx];

    // Calculate rotation so pointer (fixed at top) lands on target segment
    // Segment i occupies [i*segAngle, (i+1)*segAngle) clockwise from top
    // For pointer to hit segment i center: rotation % 360 = 360 - i*segAngle - segAngle/2
    const targetCenter = targetIdx * segAngle + segAngle / 2;
    const neededMod = ((360 - targetCenter) % 360 + 360) % 360;
    const offset = (Math.random() - 0.5) * segAngle * 0.55;

    const curMod = ((rotation % 360) + 360) % 360;
    let delta = ((neededMod + offset - curMod) % 360 + 360) % 360;
    if (delta < 60) delta += 360;

    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360;
    setRotation(rotation + fullSpins + delta);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(winner);
      onResult(winner);
    }, 4300);
  }, [spinning, n, segAngle, rotation, segments, onResult]);

  // ── Empty state ──
  if (n === 0) {
    return (
      <div className="spin-container">
        <div className="spin-title">{title}</div>
        <div className="spin-empty">Select at least one player for the wheel</div>
      </div>
    );
  }

  // ── Single segment ── no need to spin
  if (n === 1) {
    return (
      <div className="spin-container">
        <div className="spin-title">{title}</div>
        <div className="spin-wheel-wrapper">
          <div className="spin-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <polygon points="12,22 3,4 21,4" fill="#14532d" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="spin-wheel-rotator">
            <svg className="spin-wheel-svg" viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={CX} cy={CY} r={R} fill={palette[0]} stroke="#fff" strokeWidth="2" />
              <text
                x={CX}
                y={CY - R * 0.35}
                fill="#fff"
                fontSize="14"
                fontWeight="700"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {segments[0]}
              </text>
              <circle cx={CX} cy={CY} r={20} fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx={CX} cy={CY} r={16} fill="#14532d" />
            </svg>
          </div>
        </div>
        <div className="spin-result">
          <div className="spin-result-value">{segments[0]}</div>
        </div>
      </div>
    );
  }

  // ── Normal wheel ──
  const fontSize = n > 14 ? 8 : n > 10 ? 9 : n > 7 ? 10 : 12;

  return (
    <div className="spin-container">
      <div className="spin-title">{title}</div>
      <div className="spin-wheel-wrapper">
        <div className="spin-pointer">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <polygon points="12,22 3,4 21,4" fill="#14532d" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div
          className="spin-wheel-rotator"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <svg className="spin-wheel-svg" viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {segments.map((label, i) => {
              const a1 = -90 + i * segAngle;
              const a2 = -90 + (i + 1) * segAngle;
              const r1 = (a1 * Math.PI) / 180;
              const r2 = (a2 * Math.PI) / 180;
              const x1 = CX + R * Math.cos(r1);
              const y1 = CY + R * Math.sin(r1);
              const x2 = CX + R * Math.cos(r2);
              const y2 = CY + R * Math.sin(r2);
              const large = segAngle > 180 ? 1 : 0;
              const d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;

              // Label at midpoint of segment, 62% out from center
              const midA = (a1 + a2) / 2;
              const midRad = (midA * Math.PI) / 180;
              const lr = R * 0.62;
              const lx = CX + lr * Math.cos(midRad);
              const ly = CY + lr * Math.sin(midRad);

              // Rotate text along radius; flip if it would be upside-down
              const normA = ((midA % 360) + 360) % 360;
              const flip = normA > 90 && normA < 270;
              const textRot = flip ? midA + 180 : midA;

              return (
                <g key={i}>
                  <path d={d} fill={palette[i % palette.length]} stroke="#fff" strokeWidth="2" />
                  <text
                    x={lx}
                    y={ly}
                    fill="#fff"
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textRot}, ${lx}, ${ly})`}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {/* Center hub */}
            <circle cx={CX} cy={CY} r={20} fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
            <circle cx={CX} cy={CY} r={16} fill="#14532d" />
          </svg>
        </div>
      </div>
      <button
        className="spin-btn"
        onClick={handleSpin}
        disabled={spinning || n === 0}
      >
        {spinning ? 'Spinning...' : 'Spin!'}
      </button>
      {result && (
        <div className="spin-result">
          <div className="spin-result-value">{result}</div>
        </div>
      )}
    </div>
  );
}
