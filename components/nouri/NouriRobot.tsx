import { useId, type Ref } from "react";
import { EYE_L, EYE_R, NOURI_VIEWBOX, poseAttributes, type NouriPose } from "./pose";

type NouriRobotProps = {
  pose: NouriPose;
  viewBox?: string;
  preserveAspectRatio?: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  /** Accessible label; omit to mark the robot as decorative. */
  label?: string;
};

/**
 * Nouri, drawn once in scene space. Every animated part carries a `data-part`
 * attribute so poses can be applied imperatively (see `applyPose`).
 */
export function NouriRobot({
  pose,
  viewBox = NOURI_VIEWBOX,
  preserveAspectRatio,
  className,
  svgRef,
  label,
}: NouriRobotProps) {
  // Gradient ids must be unique per instance: a hidden duplicate id would break the visible one.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  const a = poseAttributes(pose);

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={id("shell")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f1f5fa" />
          <stop offset="1" stopColor="#c9d4e2" />
        </linearGradient>
        <linearGradient id={id("shellSide")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8fa3bd" stopOpacity="0.35" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.82" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#8fa3bd" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={id("visor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c1628" />
          <stop offset="1" stopColor="#03060d" />
        </linearGradient>
        <linearGradient id={id("eye")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9fbff" />
          <stop offset="0.5" stopColor="#5eeaff" />
          <stop offset="1" stopColor="#1cc6e6" />
        </linearGradient>
        <radialGradient id={id("halo")}>
          <stop offset="0" stopColor="#4ee6ff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#22d3ee" stopOpacity="0.18" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("heartGlow")}>
          <stop offset="0" stopColor="#5eeaff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#5eeaff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("shadow")}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Body — revealed by light as the camera pulls back */}
      <g data-part="litBody" {...a.litBody}>
        <ellipse cx="300" cy="568" rx="150" ry="16" fill={url("shadow")} />
        <rect x="232" y="528" width="56" height="30" rx="15" fill="#1a2436" />
        <rect x="312" y="528" width="56" height="30" rx="15" fill="#1a2436" />
        <rect x="240" y="548" width="40" height="4" rx="2" fill="#38e1f5" opacity="0.55" />
        <rect x="320" y="548" width="40" height="4" rx="2" fill="#38e1f5" opacity="0.55" />
        <rect x="258" y="322" width="84" height="26" rx="8" fill="#7d8ea6" />
        <rect x="188" y="340" width="224" height="196" rx="46" fill={url("shell")} />
        <rect x="188" y="340" width="224" height="196" rx="46" fill={url("shellSide")} />
        <circle cx="300" cy="404" r="40" fill={url("heartGlow")} />
        <path
          d="M300 424c-12-9-22-17-22-28 0-8 6-13 13-13 4 0 7 2 9 5 2-3 5-5 9-5 7 0 13 5 13 13 0 11-10 19-22 28z"
          fill="#3fe0f5"
        />
        <text
          x="300"
          y="472"
          textAnchor="middle"
          fontSize="19"
          fontWeight="600"
          letterSpacing="1"
          fill="#5b6b82"
          fontFamily="var(--font-jakarta), ui-sans-serif, system-ui, sans-serif"
        >
          Nouri
        </text>
      </g>

      {/* Head — shell, visor and face rotate together so the face never slides */}
      <g data-part="head" {...a.head}>
        <g data-part="litHead" {...a.litHead}>
          <ellipse cx="112" cy="200" rx="22" ry="44" fill={url("shell")} />
          <ellipse cx="488" cy="200" rx="22" ry="44" fill={url("shell")} />
          <ellipse cx="108" cy="200" rx="8" ry="25" fill="none" stroke="#38e1f5" strokeWidth="4" opacity="0.8" />
          <ellipse cx="492" cy="200" rx="8" ry="25" fill="none" stroke="#38e1f5" strokeWidth="4" opacity="0.8" />
          <rect x="281" y="52" width="38" height="22" rx="11" fill={url("shell")} />
          <rect x="289" y="58" width="22" height="9" rx="4.5" fill="#5eeaff" />
          <rect x="120" y="70" width="360" height="260" rx="96" fill={url("shell")} />
          <rect x="120" y="70" width="360" height="260" rx="96" fill={url("shellSide")} />
          <rect x="150" y="98" width="300" height="204" rx="74" fill={url("visor")} />
          <path
            d="M186 122c30-12 70-14 104-14"
            stroke="#ffffff"
            strokeOpacity="0.08"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        <ellipse data-part="haloL" {...a.haloL} cx={EYE_L.x} cy={EYE_L.y} rx="70" ry="78" fill={url("halo")} />
        <ellipse data-part="haloR" {...a.haloR} cx={EYE_R.x} cy={EYE_R.y} rx="70" ry="78" fill={url("halo")} />

        <g data-part="cheeks" {...a.cheeks}>
          <ellipse cx="194" cy="250" rx="14" ry="7" fill="#ff9fb0" />
          <ellipse cx="406" cy="250" rx="14" ry="7" fill="#ff9fb0" />
        </g>

        {[
          { c: EYE_L, eye: a.eyeL, pupil: a.pupilL, eyePart: "eyeL", pupilPart: "pupilL" },
          { c: EYE_R, eye: a.eyeR, pupil: a.pupilR, eyePart: "eyeR", pupilPart: "pupilR" },
        ].map(({ c, eye, pupil, eyePart, pupilPart }) => (
          <g key={eyePart} data-part={eyePart} {...eye}>
            <ellipse cx={c.x} cy={c.y} rx="31" ry="39" fill={url("eye")} />
            <g data-part={pupilPart} {...pupil}>
              <ellipse cx={c.x} cy={c.y} rx="21" ry="29" fill="#04101c" />
              <circle cx={c.x - 7} cy={c.y - 12} r="6.5" fill="#ffffff" />
              <circle cx={c.x + 8} cy={c.y + 11} r="2.6" fill="#ffffff" opacity="0.6" />
            </g>
          </g>
        ))}

        <path
          data-part="browL"
          {...a.browL}
          d={`M${EYE_L.x - 21} ${EYE_L.y - 57}Q${EYE_L.x} ${EYE_L.y - 70} ${EYE_L.x + 21} ${EYE_L.y - 57}`}
          stroke="#67e8f9"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          data-part="browR"
          {...a.browR}
          d={`M${EYE_R.x - 21} ${EYE_R.y - 57}Q${EYE_R.x} ${EYE_R.y - 70} ${EYE_R.x + 21} ${EYE_R.y - 57}`}
          stroke="#67e8f9"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        <path
          data-part="smileHalo"
          {...a.smileHalo}
          d="M266 256Q300 284 334 256"
          pathLength={1}
          strokeDasharray="1 1"
          stroke="#22d3ee"
          strokeWidth="20"
          strokeLinecap="round"
          fill="none"
        />
        <path
          data-part="smile"
          {...a.smile}
          d="M266 256Q300 284 334 256"
          pathLength={1}
          strokeDasharray="1 1"
          stroke="#7ef4ff"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
