let currentSearchProfile = null;

function buildUserProfile() {
    if(window.BScoutSearchState){
        const settings=window.BScoutSearchState.readFromDocument(document);
        if(currentSearchProfile)currentSearchProfile.SearchSettings=settings;
        return settings;
    }
    const textSearch =
        document.getElementById("textSearch")?.value?.trim().toLowerCase() || "";

    const minLengthVal = document.getElementById("minLength")?.value;
    const minLength = minLengthVal ? Number(minLengthVal) : null;

    const maxLengthVal = document.getElementById("maxLength")?.value;
    const maxLength = maxLengthVal ? Number(maxLengthVal) : null;

    const minBeamVal = document.getElementById("minBeam")?.value;
    const minBeam = minBeamVal ? Number(String(minBeamVal).replace(",", ".")) : null;

    const maxBeamVal = document.getElementById("maxBeam")?.value;
    const maxBeam = maxBeamVal ? Number(String(maxBeamVal).replace(",", ".")) : null;

    const routes =
        Array.from(
            document.querySelectorAll("#discoverView .routeFilter:checked")
        )
        .map(x => x.value);

    const styles =
        Array.from(
            document.querySelectorAll("#discoverView .styleFilter:checked")
        )
        .map(x => x.value);

    const hulls =
        Array.from(
            document.querySelectorAll("#discoverView .hullFilter:checked")
        )
        .map(x => x.value);

    const fuels =
        Array.from(
            document.querySelectorAll("#discoverView .fuelFilter:checked")
        )
        .map(x => x.value);

    const propulsion =
        Array.from(
            document.querySelectorAll("#discoverView .propulsionFilter:checked")
        )
        .map(x => x.value);

    const engineCounts = Array.from(document.querySelectorAll("#discoverView .engineCountFilter:checked")).map(x => Number(x.value));
    const twinEngines = false;

    const flybridge =
        document.getElementById("flybridgeFilter")?.value || "";

    const sideDecks =
        document.getElementById("sideDeckFilter")?.value || "";

    const loop =
        document.getElementById("loopFilter")?.value || "";

    const trailer =
        document.getElementById("trailerFilter")?.value || "";

    const profileData = {
        textSearch: textSearch,
        routes: routes,
        cruisingIntent: [],
        maxPrice: null,
        minLength: minLength,
        maxLength: maxLength,
        minBeam: minBeam,
        maxBeam: maxBeam,
        maxDraft: null,
        maxAirDraft: null,
        styles: styles,
        boatFamilies: Array.from(document.querySelectorAll("#discoverView .familyFilter:checked")).map(x => x.value),
        configurations: Array.from(document.querySelectorAll("#discoverView .configurationFilter:checked")).map(x => x.value),
        constructionMaterials: Array.from(document.querySelectorAll("#discoverView .constructionFilter:checked")).map(x => x.value),
        hullTypes: hulls,
        fuels: fuels,
        propulsion: propulsion,
        engineCounts: engineCounts,
        twinEngines: twinEngines,
        flybridge: flybridge,
        sideDecks: sideDecks,
        trailerable: trailer,
        greatLoop: loop,
        minimumBerths: null,
        minimumCabins: null,
        minimumHeads: null,
        crewComposition: document.getElementById("crewComposition")?.value || "",
        tallestCrewHeight: document.getElementById("tallestCrewHeight")?.value ? Number(document.getElementById("tallestCrewHeight").value) : null,
        guestFrequency: document.getElementById("guestFrequency")?.value || "",
        featurePriorities: Array.from(document.querySelectorAll("#discoverView .featurePriority")).reduce((result, node) => {
            if (node.value) result[node.dataset.feature] = node.value;
            return result;
        }, {})
    };

    if (currentSearchProfile) {
        currentSearchProfile.SearchSettings = profileData;
    }

    return profileData;
}

window.buildUserProfile = buildUserProfile;

// Expose currentSearchProfile globally via window
Object.defineProperty(window, 'currentSearchProfile', {
    get() { return currentSearchProfile; },
    set(val) { currentSearchProfile = val; },
    configurable: true,
    enumerable: true
});
