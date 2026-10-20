const routeChecks = [
    { canonicalField: "AirDraft", routeField: "MaxAirDraftFt", label: "Air Draft" },
    { canonicalField: "Draft", routeField: "MaxDraftFt", label: "Draft" },
    { canonicalField: "Beam", routeField: "MaxBeamFt", label: "Beam" },
    { canonicalField: "LOA", routeField: "MaxLengthFt", label: "Length" }
];

function failsLimit(boatValue, routeLimit) {
    if (routeLimit === undefined || routeLimit === null || String(routeLimit).trim() === "") {
        return false;
    }
    if (boatValue === undefined || boatValue === null || String(boatValue).trim() === "") {
        return false;
    }
    return Number(boatValue) > Number(routeLimit);
}

function passesRouteCompatibility(boat, userProfile, routes) {
    if (typeof BScoutFilterEngine !== 'undefined') return BScoutFilterEngine.evaluateBoat(boat, {routes:userProfile?.routes || []}, routes || [], {}).passes;
    return true;
}

function passesHardFilters(boat, userProfile) {
    return true;
}

function calculateFitScore(boat, userProfile) {
    return {
        score: 100,
        reasons: [],
        unknowns: []
    };
}

if (typeof window !== "undefined") {
    window.passesRouteCompatibility = passesRouteCompatibility;
    window.passesHardFilters = passesHardFilters;
    window.calculateFitScore = calculateFitScore;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        failsLimit,
        passesRouteCompatibility,
        passesHardFilters,
        calculateFitScore
    };
}
