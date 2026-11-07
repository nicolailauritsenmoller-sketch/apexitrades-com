import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function VipMembershipIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m16 5 8 2 5 8-13 13L3 15l5-8Z" /><path d="m10 14 4 4 8-8" /></svg>;
}
export function VipPortalIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 27V15a10 10 0 0 1 20 0v12Z" /><path d="M9 23V15a7 7 0 0 1 14 0v8M4 27h24M10 23h12" /><circle cx="16" cy="13" r="2.5" /><path d="m13 18 3-2 3 2" /></svg>;
}
export function VipInsightsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 6h24v22H4ZM4 11h24M8 23l6-6 5 3 5-6" /></svg>;
}
export function VipSpecialistIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="13" cy="7" r="3" /><path d="M6 27v-8a7 7 0 0 1 14 0M10 17l3 7 3-7M10 27v-5M17 27v-5m8-8 5 2-1 6-4 4-4-4-1-6Z" /><path d="M25 18v5" /></svg>;
}
export function VipDiamondIcon(props: IconProps) {
  return <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" {...props}><path d="m3 31 24-29h66l24 29-57 67ZM3 31h114M27 2l-9 29 42 67L102 31 93 2M18 31 60 2l42 29M27 2l33 96L93 2" /></svg>;
}