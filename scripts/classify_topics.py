"""Assign a study topic ("tema") to every question of a bank, by keyword scoring.

    python scripts/classify_topics.py powerplant        # print distribution + unsure items
    python scripts/classify_topics.py powerplant --write

Questions that already have a "tema" from the canonical list for that bank are left alone
unless --force is given, so manual corrections in the JSON survive re-runs.
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BANKS = {"airframe": "airframe.json", "powerplant": "powerplant.json", "standard": "questions.json"}

# topic -> (weight, regex) list. Regexes are matched (case-insensitively) against
# the question + all options; the answer text counts double.
RULES: dict[str, dict[str, list[tuple[int, str]]]] = {
    "powerplant": {
        "Propellers": [
            (3, r"propell|\bprop\b|\bprops\b|blade angle|pitch (lock|stop|change)|feather|governor|hub|slinger|synchro|spinner|hydromatic|hartzell|mccauley|counterweight|speeder spring|flyweight|beta (range|mode)|alpha mode|reverse pitch|blade station|track(ing)?\b|protractor|dome|geometric pitch|effective pitch|\bslip\b"),
        ],
        "Turbine engines": [
            (3, r"turbine|turbo ?(jet|fan|prop|shaft)|compressor|\bEGT\b|\bEPR\b|\bITT\b|\bTIT\b|\bN1\b|\bN2\b|\bNg\b|igniter|combust(or|ion chamber)|afterburn|thrust reverser|\bthrust\b|bleed air|stator|nozzle|annular|can-annular|diffuser|flameout|hung start|hot start|\bAPU\b|bypass|axial|centrifugal.flow|fir.tree|blisk|shroud|creep|fuel control|\bFCU\b|trimming|jet engine|exhaust (cone|duct)|burner|gas path|tailpipe|inlet guide vane|\bIGV"),
        ],
        "Engine Systems & Electrical": [
            (2, r"generator|alternator|battery|batteries|electrical|voltage|regulator|relay|rectifier|transformer|commutator|starter|fire (detect|warning|extinguish)|continuous.loop|thermocouple|oil (pressure|temperature|filter|screen|cooler|scaveng|tank|dilution|analysis)|lubricat|dry sump|wet sump|scaveng|fuel (line|starvation|pump|tank|flow|filter|heater|nozzle|system|selector|vent)|standard (day|temperature|atmospher)|horsepower|specific fuel|nitrid|stud|shield|spectrometric|synthetic|SOAP|calorific|JP-?\d|avgas|octane|hydraulic|pneumatic|tachometer|gauge|indicator|instrument|sensor|bulb|transmitter"),
        ],
        "Piston engines": [
            (3, r"piston|cylinder|crank|camshaft|cam ring|magneto|spark plug|carburet|carb\b|\bmixture\b|detonation|pre-?ignition|backfir|afterfir|valve (clearance|lifter|stem|guide|seat|overlap|lag|lead|timing)|radial|horizontally opposed|\bBHP\b|\bIHP\b|\bBMEP\b|manifold pressure|compression (ratio|check|test)|differential pressure|supercharg|turbocharg|impulse coupling|breaker points|\bE-?gap\b|reciprocating|connecting rod|float|venturi|idle|blow-?by|oil dilution|dispersant|octane|tetraethyl|displacement|stroke|\bTDC\b|\bBDC\b|dead cent|four.stroke|two.stroke|primer|induction|baffl|cowl|exhaust (valve|system|manifold)|lifter|rocker|push.?rod|timing"),
        ],
    },
    "airframe": {
        "Helicopters": [
            (4, r"helicopter|rotor|swashplate|collective|cyclic|autorotat|coning|flapping|lead.lag|dissymmetry|coriolis|translational|transverse flow|ground resonance|mast|tail rotor|anti-?torque|pedal|semi-?rigid|fully articulated|underslung|stabilizer bar|freewheel|free.?wheeling|tip.path|blade (track|align)|chordwise|spanwise|gyroscopic precession|torque effect|\bRPM\b.*rotor|rotor.*\bRPM\b|hover|retreating|advancing blade|teeter|drag hinge|damper|dampener|pitch link|drive link|twist grip|gradient unit|transmission"),
        ],
        "Hydraulics, Landing Gear & Brakes": [
            (3, r"hydraulic|accumulator|actuat|selector valve|shuttle valve|priority valve|relief valve|check valve|sequence valve|reservoir|skydrol|phosphate ester|mil-?h-?5606|\bseals?\b|o-?ring|landing gear|oleo|strut|shimmy|torque link|centering cam|\btire|\btyre|wheel|brake|debooster|master cylinder|anti-?skid|fusible plug|bead|retract|squat switch|chattering|cavitation|pump\b|micron|filter"),
        ],
        "Flight Controls & Aerodynamics": [
            (3, r"aileron|elevator|rudder|\btab\b|servo|trim|flutter|control (cable|surface|column|yoke|lock|rod)|cable|turnbuckle|fairlead|pulley|swage|splice|rigging|rig\b|angle of (attack|incidence)|dihedral|wash-?(in|out)|stall|lift\b|drag\b|boundary layer|laminar|airfoil|airflow|camber|chord|aspect ratio|center of pressure|\bC of P\b|stability|axis|axes|flap|slat|slot|spoiler|vortex generator|wing fence|winglet|sweep|stagger|decalage|snubber|load factor|\bG\b|positive load|negative load|differential aileron|balance (tab|weight)|static balance|dynamic balance|fowler|leading edge|trailing edge|wing loading|bernoulli|newton"),
        ],
        "Structures, Fabric & Sheet Metal": [
            (3, r"monocoque|longeron|stringer|former|bulkhead|spar|rib\b|truss|cantilever|fabric|dope|rib.?lac|stitch|seam|warp|bias|pinhole|blush|orange peel|rivet|sheet metal|bend (line|radius)|alclad|anodiz|corrosion|zinc chromate|heat treat|anneal|normaliz|17S|2017|2024|2117|hardness|brinell|rockwell|welding|weld\b|flux|plywood|wood|glue|grain|spar\b|tubular|steel (tubing|bolt)|4130|18-8|stainless|composite|honeycomb|delamination|plexi|windshield|fiber lock|bolt|nut\b|safety wire|cotter|hardware|datum|station|buttock|zyglo|penetrant|magnesium|flared tube|37 degrees|fairing|fillet|chafer|safety belt"),
        ],
        "Pressurization, Air Conditioning & Oxygen": [
            (3, r"pressuriz|cabin (altitude|pressure|rate)|outflow|isobaric|differential (mode|pressure)|negative pressure relief|dump valve|safety valve|supercharger|air cycle|\bACM\b|expansion turbine|vapor.cycle|freon|refrigerant|condenser|evaporator|compressor|receiver.dr(y|i)er|sight (gauge|glass)|air conditioning|heater|combustion heater|thermostat|oxygen|\bO2\b|diluter|demand regulator|de-?ic|anti-?ic|boot|rain|bleed air|venturi|flow control valve|water separator|altitude warning|mask"),
        ],
        "Electrical, Instruments & Avionics": [
            (3, r"generator|alternator|battery|batteries|nicad|ni-?cd|lead.acid|electrolyte|specific gravity|voltage regulator|inverter|rectifier|\bTRU\b|\bCSD\b|\bIDG\b|bus\b|relay|circuit breaker|fuse|\bwire\b|wiring|bonding|grounding|static|solder|terminal|junction box|ohm|ampere|amperage|\bvolt|\bAC\b|\bDC\b|proximity|sensor|switch|capacitance|fuel quantity|gauge|indicator|instrument|altimeter|airspeed|\bASI\b|\bVSI\b|pitot|static (system|port|line)|compass|swing|deviation|gyro|autopilot|\bADF\b|\bVOR\b|\bILS\b|localizer|glide slope|marker beacon|transponder|antenna|radio|\bVHF\b|\bHF\b|selsyn|autosyn|thermocouple|fire (warning|detect|extinguish)|\bCO2\b|lamp|light|stall warning|tachometer"),
        ],
        "Fuel Systems & Weight and Balance": [
            (3, r"fuel (tank|cell|line|system|pump|boost|quantity|vent|cap|strainer|filter|selector|crossfeed)|integral tank|bladder|flapper valve|gascolator|refuel|octane|\bC of G\b|\bCG\b|center of gravity|centre of gravity|weight and balance|\barm\b|moment|datum|tare|useful load|empty weight|\bMAC\b|ballast|jack|leveling|weighing|\bEWCG\b|scales?\b|fuel color|100/130|80/87|avgas|jet fuel|microb"),
        ],
    },
    "standard": {
        "Physics & Math": [
            (3, r"\bforce\b|pressure|\bwork\b|\bpower\b|energy|velocity|acceleration|mass|weight|density|volume|area|temperature|heat|celsius|fahrenheit|kelvin|expansion|lever|fulcrum|mechanical advantage|pulley|gear ratio|ratio|percent|fraction|decimal|square root|\bpi\b|circumference|diameter|radius|formula|calculate|equals|\bsin\b|\bcos\b|\btan\b|trigonometr|triangle|angle|degrees|metric|conversion|horsepower|torque|ohm's law|bernoulli|boyle|charles|newton|archimedes|specific gravity|buoyancy|sound|light|speed of"),
        ],
        "Electrical": [
            (3, r"electric|circuit|current|voltage|\bvolt|ampere|\bamp\b|resistance|resistor|ohm|capacitor|inductor|coil|transformer|generator|alternator|motor|battery|batteries|\bAC\b|\bDC\b|series|parallel|wire|conductor|insulat|fuse|circuit breaker|relay|solenoid|switch|diode|transistor|semiconductor|magnet|flux|frequency|hertz|phase|watt|kilowatt|ground|bonding|static|multimeter|megger|ohmmeter|voltmeter|ammeter"),
        ],
        "Hardware, Materials & Processes": [
            (3, r"bolt|nut\b|screw|washer|rivet|cotter|safety wire|lock ?wire|thread|torque wrench|\btool|drill|reamer|tap\b|die\b|file\b|micrometer|caliper|vernier|gauge|feeler|aluminum|aluminium|steel|alloy|titanium|magnesium|copper|brass|bronze|metal|heat treat|anneal|temper|harden|quench|corrosion|anodiz|alodine|cadmium|chromate|plating|paint|primer|sealant|adhesive|composite|fiberglass|carbon fiber|honeycomb|plastic|rubber|fabric|wood|welding|solder|braz|tubing|tube|hose|fitting|flare|\bAN\b|\bMS\b|\bNAS\b|identification|marking|hardness|brinell|rockwell|penetrant|magnaflux|eddy current|x-?ray|ultrason|inspection|NDT|non-?destructive|lubricant|grease|oil\b"),
        ],
        "Hydraulics & Pneumatics": [
            (3, r"hydraulic|pneumatic|accumulator|actuator|cylinder|piston|fluid|skydrol|mil-?h|reservoir|relief valve|check valve|selector valve|pump|pascal|compressed air|nitrogen|seal|o-?ring|packing"),
        ],
        "Drawings, Documents & Regulations": [
            (3, r"drawing|blueprint|title block|revision|tolerance|dimension|scale|symbol|schematic|diagram|sketch|orthographic|isometric|section view|detail view|\bCAR\b|\bCARs\b|regulation|airworthiness|\bAD\b|directive|service bulletin|\bAME\b|licen[cs]e|log ?book|journey log|technical record|maintenance release|certif|transport canada|\bTC\b|\bSTC\b|\bTSO\b|manual|\bAMM\b|\bIPC\b|\bMEL\b|placard|weight and balance|\bCG\b|datum|moment|\barm\b"),
        ],
    },
}

TOPICS = {bank: list(rules.keys()) for bank, rules in RULES.items()}


def score(q: dict, bank: str) -> tuple[str, dict[str, int]]:
    text = q["pregunta"] + " " + " ".join(q["opciones"])
    answer = q["opciones"][q["correcta"]]
    scores: dict[str, int] = {}
    for topic, rules in RULES[bank].items():
        s = 0
        for weight, pattern in rules:
            rx = re.compile(pattern, re.I)
            s += weight * len(rx.findall(q["pregunta"])) * 2
            s += weight * len(rx.findall(answer)) * 2
            s += weight * len(rx.findall(text))
        scores[topic] = s
    best = max(scores, key=lambda t: scores[t])
    return best, scores


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("bank", choices=list(BANKS))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-classify even questions that already have a canonical tema")
    ap.add_argument("--show", type=int, default=25, help="how many low-confidence items to print")
    args = ap.parse_args()

    path = ROOT / "data" / BANKS[args.bank]
    questions = json.loads(path.read_text(encoding="utf-8"))
    canonical = TOPICS[args.bank]
    default = {"powerplant": "Engine Systems & Electrical", "airframe": "Structures, Fabric & Sheet Metal", "standard": "Hardware, Materials & Processes"}[args.bank]

    counts: dict[str, int] = {t: 0 for t in canonical}
    unsure: list[tuple[int, str, str, dict[str, int]]] = []
    for i, q in enumerate(questions):
        if not args.force and q.get("tema") in canonical:
            counts[q["tema"]] += 1
            continue
        best, scores = score(q, args.bank)
        ordered = sorted(scores.values(), reverse=True)
        if ordered[0] == 0:
            best = default
        if ordered[0] == 0 or (len(ordered) > 1 and ordered[0] - ordered[1] <= 2):
            unsure.append((i, q["pregunta"][:90], best, scores))
        q["tema"] = best
        counts[best] += 1

    for t in canonical:
        print(f"{counts[t]:5d}  {t}")
    print(f"\n{len(unsure)} low-confidence items (showing {min(args.show, len(unsure))}):")
    for i, text, best, scores in unsure[: args.show]:
        print(f"  [{i}] -> {best} {scores}: {text}")

    if args.write:
        path.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
        print("written")


if __name__ == "__main__":
    main()
