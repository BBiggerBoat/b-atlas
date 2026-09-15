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
    if (!userProfile || !userProfile.routes || !Array.isArray(userProfile.routes) || userProfile.routes.length === 0) {
        return true;
    }
    if (!routes || !Array.isArray(routes)) {
        return true;
    }

    for (const selectedRouteID of userProfile.routes) {
        const matchedRoute = routes.find(r => {
            const rID = r.RouteID !== undefined ? r.RouteID : r.id;
            return rID !== undefined && String(rID).trim().toUpperCase() === String(selectedRouteID).trim().toUpperCase();
        });

        if (!matchedRoute) {
            continue;
        }

        for (const check of routeChecks) {
            let boatValue = (typeof BAtlasCanonical !== "undefined" && BAtlasCanonical)
                ? BAtlasCanonical.feet(boat, check.canonicalField, [])
                : (Number.isFinite(Number(boat?.[check.canonicalField])) ? Number(boat[check.canonicalField]) / 0.3048 : null);
            // For phase-variable dimensions, exclude only when even the smallest known phase exceeds the route maximum.
            let lowEstimate=false;
            if (typeof BAtlasCanonical !== "undefined" && BAtlasCanonical?.canonicalRange) {
                const range=BAtlasCanonical.canonicalRange(boat,check.canonicalField);
                if(range) boatValue=range.min/0.3048;
                const meta=BAtlasCanonical.specificationConfidence?.(boat,check.canonicalField);
                lowEstimate=meta?.status==="estimated" && meta?.level==="Low";
            }
            let routeLimit = matchedRoute[check.routeField];
            if (routeLimit === undefined) {
                routeLimit = matchedRoute["Route" + check.routeField];
            }

            if (!lowEstimate && failsLimit(boatValue, routeLimit)) {
                return false;
            }
        }
    }

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
