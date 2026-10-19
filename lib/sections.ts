// Shared by the app, the question submission form and /admin.

export type Category = "standard" | "airframe" | "powerplant" | "airframe_verified" | "powerplant_verified";

// Review banks (questions confirmed by the Jeppesen textbooks). Only the
// admin and the e-mails in VERIFIED_ACCESS_EMAILS see them.
export const RESTRICTED_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "airframe_verified",
  "powerplant_verified",
]);

const VERIFIED_ACCESS_EMAILS = ["car1781@hotmail.com"];

export function canSeeVerified(email: string | null | undefined, isAdmin: boolean) {
  return isAdmin || (!!email && VERIFIED_ACCESS_EMAILS.includes(email.toLowerCase()));
}

export const SECTION_LABELS: Record<Category, string> = {
  standard: "Standard Practices",
  airframe: "Airframe",
  powerplant: "Powerplant",
  airframe_verified: "AF Verified Correct",
  powerplant_verified: "PP Verified Correct",
};

// Canonical topic order per bank (same names as scripts/classify_topics.py).
const AIRFRAME_TOPICS = [
  "Helicopters",
  "Hydraulics, Landing Gear & Brakes",
  "Flight Controls & Aerodynamics",
  "Structures, Fabric & Sheet Metal",
  "Pressurization, Air Conditioning & Oxygen",
  "Electrical, Instruments & Avionics",
  "Fuel Systems & Weight and Balance",
];
const POWERPLANT_TOPICS = [
  "Piston engines",
  "Propellers",
  "Turbine engines",
  "Engine Systems & Electrical",
];

export const TOPIC_ORDER: Record<Category, string[]> = {
  standard: [
    "Physics & Math",
    "Electrical",
    "Hardware, Materials & Processes",
    "Hydraulics & Pneumatics",
    "Drawings, Documents & Regulations",
  ],
  airframe: AIRFRAME_TOPICS,
  powerplant: POWERPLANT_TOPICS,
  airframe_verified: AIRFRAME_TOPICS,
  powerplant_verified: POWERPLANT_TOPICS,
};

export function isCategory(value: unknown): value is Category {
  return (
    value === "standard" ||
    value === "airframe" ||
    value === "powerplant" ||
    value === "airframe_verified" ||
    value === "powerplant_verified"
  );
}

// Public contact address shown in the footer and on /legal.
export const SUPPORT_EMAIL = "m2canadasupport@gmail.com";
