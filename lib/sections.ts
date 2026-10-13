// Shared by the app, the question submission form and /admin.

export type Category = "standard" | "airframe" | "powerplant";

export const SECTION_LABELS: Record<Category, string> = {
  standard: "Standard Practices",
  airframe: "Airframe",
  powerplant: "Powerplant",
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
};

export function isCategory(value: unknown): value is Category {
  return value === "standard" || value === "airframe" || value === "powerplant";
}

// Public contact address (forwarded to the admin's inbox).
export const SUPPORT_EMAIL = "support@m2canada.ca";
