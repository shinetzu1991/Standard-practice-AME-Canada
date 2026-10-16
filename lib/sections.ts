// Shared by the app, the question submission form and /admin.

export type Category = "standard" | "airframe" | "powerplant" | "powerplant_verified";

// Sections only the admin sees (review banks).
export const ADMIN_ONLY_CATEGORIES: ReadonlySet<Category> = new Set<Category>(["powerplant_verified"]);

export const SECTION_LABELS: Record<Category, string> = {
  standard: "Standard Practices",
  airframe: "Airframe",
  powerplant: "Powerplant",
  powerplant_verified: "Powerplant Verified",
};

// Canonical topic order per bank (same names as scripts/classify_topics.py).
export const TOPIC_ORDER: Record<Category, string[]> = {
  standard: [
    "Physics & Math",
    "Electrical",
    "Hardware, Materials & Processes",
    "Hydraulics & Pneumatics",
    "Drawings, Documents & Regulations",
  ],
  airframe: [
    "Helicopters",
    "Hydraulics, Landing Gear & Brakes",
    "Flight Controls & Aerodynamics",
    "Structures, Fabric & Sheet Metal",
    "Pressurization, Air Conditioning & Oxygen",
    "Electrical, Instruments & Avionics",
    "Fuel Systems & Weight and Balance",
  ],
  powerplant: [
    "Piston engines",
    "Propellers",
    "Turbine engines",
    "Engine Systems & Electrical",
  ],
  powerplant_verified: [
    "Piston engines",
    "Propellers",
    "Turbine engines",
    "Engine Systems & Electrical",
  ],
};

export function isCategory(value: unknown): value is Category {
  return (
    value === "standard" ||
    value === "airframe" ||
    value === "powerplant" ||
    value === "powerplant_verified"
  );
}

// Public contact address shown in the footer and on /legal.
export const SUPPORT_EMAIL = "m2canadasupport@gmail.com";
