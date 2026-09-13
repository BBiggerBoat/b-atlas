(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.BScoutKnowledgeLayerRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    function text(value) { return String(value == null ? "" : value).trim(); }
    function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

    function createKnowledgeIndex(data) {
        const source = data || {};
        const evidence = Array.isArray(source.evidence) ? source.evidence : [];
        const contradictions = Array.isArray(source.contradictions) ? source.contradictions : [];
        const relationships = Array.isArray(source.relationships) ? source.relationships : [];
        const coverage = Array.isArray(source.knowledgeCoverage) ? source.knowledgeCoverage : [];
        const sourcesByBoat = new Map();
        const conflictsByBoat = new Map();
        const relationshipsByBoat = new Map();
        const coverageByBoat = new Map(coverage.map(item => [text(item.BoatModelID), item]));

        evidence.forEach(item => {
            const id = text(item.BoatModelID);
            if (!id) return;
            if (!sourcesByBoat.has(id)) sourcesByBoat.set(id, []);
            sourcesByBoat.get(id).push(item);
        });
        contradictions.forEach(item => {
            const id = text(item.BoatModelID);
            if (!conflictsByBoat.has(id)) conflictsByBoat.set(id, []);
            conflictsByBoat.get(id).push(item);
        });
        relationships.forEach(item => {
            [item.FromBoatModelID, item.ToBoatModelID].forEach(value => {
                const id = text(value);
                if (!relationshipsByBoat.has(id)) relationshipsByBoat.set(id, []);
                relationshipsByBoat.get(id).push(item);
            });
        });

        return { sourcesByBoat, conflictsByBoat, relationshipsByBoat, coverageByBoat };
    }

    function getBoatKnowledge(index, boatModelId) {
        const id = text(boatModelId);
        return {
            BoatModelID: id,
            Evidence: clone(index.sourcesByBoat.get(id) || []),
            Contradictions: clone(index.conflictsByBoat.get(id) || []),
            Relationships: clone(index.relationshipsByBoat.get(id) || []),
            Coverage: clone(index.coverageByBoat.get(id) || null)
        };
    }

    function validateKnowledgeData(data, boatIds) {
        const source = data || {};
        const errors = [];
        const knownBoats = new Set(Array.isArray(boatIds) ? boatIds.map(text) : []);
        const evidence = Array.isArray(source.evidence) ? source.evidence : [];
        const relationships = Array.isArray(source.relationships) ? source.relationships : [];
        const sourceIds = new Set();
        evidence.forEach((item, index) => {
            const sourceId = text(item.SourceID);
            if (!sourceId) errors.push(`evidence[${index}] SourceID is required`);
            if (sourceIds.has(sourceId)) errors.push(`duplicate SourceID '${sourceId}'`);
            sourceIds.add(sourceId);
            if (knownBoats.size && item.BoatModelID && !knownBoats.has(text(item.BoatModelID))) errors.push(`orphan evidence '${sourceId}'`);
        });
        relationships.forEach((item, index) => {
            if (knownBoats.size && !knownBoats.has(text(item.FromBoatModelID))) errors.push(`relationships[${index}] missing from-boat`);
            if (knownBoats.size && !knownBoats.has(text(item.ToBoatModelID))) errors.push(`relationships[${index}] missing to-boat`);
            if (text(item.FromBoatModelID) === text(item.ToBoatModelID)) errors.push(`relationships[${index}] self-reference`);
        });
        return { valid: errors.length === 0, errors };
    }

    return { createKnowledgeIndex, getBoatKnowledge, validateKnowledgeData };
});
