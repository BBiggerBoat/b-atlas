(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BScoutBoatIntelligenceRepository = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const SCHEMA_VERSION = 4;
    const CONFIDENCE_LEVELS = Object.freeze(['Unknown', 'Low', 'Medium', 'High']);
    const RATING_LEVELS = Object.freeze(['Unknown', 'Low', 'Moderate', 'High']);

    function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
    function asArray(value) { return Array.isArray(value) ? clone(value) : []; }
    function text(value) { return String(value == null ? '' : value).trim(); }
    function enumValue(value, allowed, fallback) {
        const match = allowed.find(item => item.toLowerCase() === text(value).toLowerCase());
        return match || fallback;
    }
    function normalizeEvidence(item) {
        const source = item && typeof item === 'object' ? item : {};
        return {
            claim: text(source.claim),
            evidenceType: text(source.evidenceType) || 'EditorialAssessment',
            confidence: enumValue(source.confidence, CONFIDENCE_LEVELS, 'Unknown'),
            sourceRefs: asArray(source.sourceRefs).map(text).filter(Boolean)
        };
    }
    function normalizeRecord(input) {
        const source = input && typeof input === 'object' ? input : {};
        const identity = source.identity && typeof source.identity === 'object' ? source.identity : {
            manufacturer:source.Manufacturer, model:[source.Model,source.Variant].filter(Boolean).join(' '), displayName:source.Nickname
        };
        // The public model view is flat. Adapt its existing guidance rather than
        // replacing populated knowledge-card sections with empty legacy defaults.
        const list = value => Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
        const intelligence = source.intelligence && typeof source.intelligence === 'object' ? source.intelligence : (source.SupplementalIntelligence && typeof source.SupplementalIntelligence === 'object' ? source.SupplementalIntelligence : {
            signature:source.BScoutSignature, characterNarrative:source.ModelCharacter,
            ownershipCharacter:source.OwnershipCharacter, designLineage:source.DesignLineage,
            strengths:list(source.Strengths), tradeoffs:list(source.TradeOffs || source.Weaknesses),
            bestMissions:list(source.BestFor), lessSuitableIf:list(source.AvoidIf),
            inspectionPriorities:list(source.InspectionFocus),
            crewFit:{bestFor:list(source.CrewFitBestFor),cautions:list(source.CrewFitCautions)}
        });
        return {
            schemaVersion: Number(source.schemaVersion) || SCHEMA_VERSION,
            identity: {
                boatModelId: text(source.BoatModelID || identity.boatModelId || identity.BoatModelID),
                manufacturer: text(identity.manufacturer || identity.Manufacturer),
                model: text(identity.model || identity.Model),
                displayName: text(identity.displayName)
            },
            intelligence: {
                signature: text(intelligence.signature),
                designPhilosophy: text(intelligence.designPhilosophy),
                personality: text(intelligence.personality),
                idealOwner: text(intelligence.idealOwner),
                characterNarrative: text(intelligence.characterNarrative),
                ownershipCharacter: text(intelligence.ownershipCharacter),
                designLineage: asArray(intelligence.designLineage).map(text).filter(Boolean),
                buyerProfile: text(intelligence.buyerProfile),
                lessSuitableIf: asArray(intelligence.lessSuitableIf).map(text).filter(Boolean),
                ownershipEase: enumValue(intelligence.ownershipEase, RATING_LEVELS, 'Unknown'),
                maintenanceEase: enumValue(intelligence.maintenanceEase, RATING_LEVELS, 'Unknown'),
                marketAvailability: text(intelligence.marketAvailability) || 'Unknown',
                partsAvailability: text(intelligence.partsAvailability) || 'Unknown',
                ownershipScores: intelligence.ownershipScores && typeof intelligence.ownershipScores === 'object' ? clone(intelligence.ownershipScores) : {},
                refitPriority: intelligence.refitPriority && typeof intelligence.refitPriority === 'object' ? clone(intelligence.refitPriority) : {},
                knowledgeRelationships: intelligence.knowledgeRelationships && typeof intelligence.knowledgeRelationships === 'object' ? clone(intelligence.knowledgeRelationships) : {},
                sectionConfidence: intelligence.sectionConfidence && typeof intelligence.sectionConfidence === 'object' ? clone(intelligence.sectionConfidence) : {},
                bScoutNotes: asArray(intelligence.bScoutNotes).map(text).filter(Boolean),
                bestMissions: asArray(intelligence.bestMissions).map(text).filter(Boolean),
                lessSuitableMissions: asArray(intelligence.lessSuitableMissions).map(text).filter(Boolean),
                strengths: asArray(intelligence.strengths).map(text).filter(Boolean),
                tradeoffs: asArray(intelligence.tradeoffs).map(text).filter(Boolean),
                inspectionPriorities: asArray(intelligence.inspectionPriorities).map(text).filter(Boolean),
                commonUpgrades: asArray(intelligence.commonUpgrades).map(text).filter(Boolean),
                comparableModels: asArray(intelligence.comparableModels).map(text).filter(Boolean),
                crewFit: {
                    bestFor: asArray(intelligence.crewFit && intelligence.crewFit.bestFor).map(text).filter(Boolean),
                    cautions: asArray(intelligence.crewFit && intelligence.crewFit.cautions).map(text).filter(Boolean)
                }
            },
            evidence: asArray(source.evidence || source.SupplementalEvidence).map(normalizeEvidence).filter(item => item.claim),
            confidence: enumValue(source.confidence || source.SupplementalConfidence, CONFIDENCE_LEVELS, 'Unknown'),
            updatedAt: (source.updatedAt || source.SupplementalUpdatedAt || source.LastUpdated) ? text(source.updatedAt || source.SupplementalUpdatedAt || source.LastUpdated) : null,
            revision: Number(source.revision || source.SupplementalRevision || source.Revision) || 1
        };
    }
    function validateRecord(input) {
        const record = normalizeRecord(input);
        const errors = [];
        if (!record.identity.boatModelId) errors.push('identity.boatModelId is required');
        if (!record.intelligence.designPhilosophy) errors.push('intelligence.designPhilosophy is required');
        if (!record.intelligence.idealOwner) errors.push('intelligence.idealOwner is required');
        return { valid: errors.length === 0, errors, record };
    }
    function findRecord(records, boatModelId) {
        const id = text(boatModelId);
        if (!id || !Array.isArray(records)) return null;
        const found = records.find(item => text(item.BoatModelID || item.identity?.boatModelId || item.identity?.BoatModelID) === id);
        return found ? normalizeRecord(found) : null;
    }
    function validateCollection(records) {
        if (!Array.isArray(records)) return { valid: false, errors: ['collection must be an array'], records: [] };
        const normalized = [];
        const errors = [];
        const ids = new Set();
        records.forEach((item, index) => {
            const result = validateRecord(item);
            if (!result.valid) result.errors.forEach(error => errors.push(`[${index}] ${error}`));
            if (result.record.identity.boatModelId) {
                if (ids.has(result.record.identity.boatModelId)) errors.push(`[${index}] duplicate boatModelId '${result.record.identity.boatModelId}'`);
                ids.add(result.record.identity.boatModelId);
            }
            normalized.push(result.record);
        });
        return { valid: errors.length === 0, errors, records: normalized };
    }

    return { SCHEMA_VERSION, CONFIDENCE_LEVELS, RATING_LEVELS, normalizeRecord, validateRecord, validateCollection, findRecord };
});
