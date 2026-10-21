(function (global) {
    "use strict";
    const MAPS = {
        hullType: {
            "displacement": "displacement", "full displacement": "displacement", "displacement hull": "displacement", "full displacement hull": "displacement", "full-displacement": "displacement", "full-displacement trawler form": "displacement",
            "semi displacement": "semi-displacement", "semi-displacement": "semi-displacement", "semi displacement hull": "semi-displacement",
            "planing": "planing", "planing hull": "planing"
        },
        boatStyle: {
            "trawler": "trawler", "classic trawler": "trawler", "sedan trawler": "trawler", "aft cabin trawler": "trawler",
            "pilothouse": "pilothouse", "pilot house": "pilothouse", "motor yacht": "motor-yacht", "motoryacht": "motor-yacht"
        },
        fuel: { "diesel": "diesel", "gas": "gasoline", "gasoline": "gasoline", "petrol": "gasoline", "gasoline petrol": "gasoline", "electric": "electric" },
        propulsion: { "shaft": "shaft", "shaft drive": "shaft", "inboard shaft": "shaft", "direct drive": "shaft", "sterndrive": "stern-drive", "stern drive": "stern-drive", "outdrive": "stern-drive", "outboard": "outboard", "pod": "pod-drive", "pod drive": "pod-drive", "jet": "jet-drive", "jet drive": "jet-drive" },
        construction: { "fiberglass": "fiberglass", "fibreglass": "fiberglass", "frp": "fiberglass", "grp": "fiberglass", "wood": "wood", "wooden": "wood", "steel": "steel", "aluminum": "aluminum", "aluminium": "aluminum" },
        cooling: { "fresh water cooled": "freshwater", "freshwater cooled": "freshwater", "fresh water": "freshwater", "closed cooling": "freshwater", "raw water cooled": "raw-water", "raw water": "raw-water", "open cooling": "raw-water" },
        driveType: { "single": "single", "single screw": "single", "single engine": "single", "twin": "twin", "twin screw": "twin", "twin engine": "twin" }
    };
    function key(value) { return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    function normalize(domain, value) {
        const cleaned = key(value);
        const aliases = {
            propulsion: { 'v drive':'shaft', 'shaft v drive':'shaft', 'vdrive':'shaft', 'ips':'pod-drive', 'ips pod':'pod-drive', 'zeus':'pod-drive', 'zeus pod':'pod-drive', 'pod zeus':'pod-drive' },
            construction: { 'fiberglass composite':'fiberglass', 'glass reinforced plastic':'fiberglass' },
            boatStyle: { 'expresscruiser':'express cruiser', 'sedanbridge':'sedan bridge', 'bowrider':'bowrider' }
        };
        return aliases[domain]?.[cleaned] || MAPS[domain]?.[cleaned] || cleaned;
    }
    function normalizeMany(domain, values) { return (Array.isArray(values) ? values : []).map(value => normalize(domain, value)).filter(Boolean); }
    function matches(domain, selected, actual) { if (actual === undefined || actual === null || actual === "") return true; const normalizedActual = normalize(domain, actual); return normalizeMany(domain, selected).includes(normalizedActual); }
    global.BScoutValueNormalizer = { MAPS, key, normalize, normalizeMany, matches };
})(typeof window !== "undefined" ? window : globalThis);
