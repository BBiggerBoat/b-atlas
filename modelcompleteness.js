(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BScoutModelCompleteness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GROUPS = [
    {
      id: 'identity', label: 'Identity', weight: 10,
      fields: ['BoatModelID', 'Manufacturer', 'Model', 'FirstYear', 'LastYear']
    },
    {
      id: 'search', label: 'Search-critical', weight: 35,
      fields: ['LOA', 'Beam', 'Draft', 'AirDraft', 'NormalizedFuel', 'NormalizedPropulsion', 'NormalizedHullForm', 'NormalizedHullConfiguration', 'NormalizedStyle', 'Flybridge', 'AftCabin', 'SideDecks', 'Trailerable']
    },
    {
      id: 'propulsion', label: 'Propulsion & capacity', weight: 15,
      fields: ['EngineConfiguration', 'TypicalEngineID', 'FuelCapacity', 'WaterCapacity', 'HoldingCapacity', 'Cooling']
    },
    {
      id: 'accommodation', label: 'Accommodation', weight: 10,
      fields: ['Berths', 'Cabins', 'Heads', 'Shower', 'Galley']
    },
    {
      id: 'mission', label: 'Mission suitability', weight: 10,
      fields: ['CoastalRating', 'OffshoreRating', 'GreatLoopSuitable', 'TypicalMission', 'AvoidIf']
    },
    {
      id: 'knowledge', label: 'Buyer knowledge', weight: 15,
      fields: ['Construction', 'KeelType', 'Strengths', 'Weaknesses', 'CommonProblems', 'Features']
    },
    {
      id: 'governance', label: 'Research governance', weight: 5,
      fields: ['DataConfidence', 'ResearchStatus', 'ResearchNotes', 'LastUpdated', 'ReviewedBy']
    }
  ];

  const FIELD_LABELS = {
    BoatModelID: 'Boat model ID', Manufacturer: 'Manufacturer', Model: 'Model', FirstYear: 'First year', LastYear: 'Last year',
    LOA: 'Length overall', Beam: 'Beam', Draft: 'Draft', AirDraft: 'Air draft',
    NormalizedFuel: 'Normalized fuel', NormalizedPropulsion: 'Normalized propulsion', NormalizedHullForm: 'Normalized hull form',
    NormalizedHullConfiguration: 'Normalized hull configuration', NormalizedStyle: 'Normalized style',
    Flybridge: 'Flybridge', AftCabin: 'Aft cabin', SideDecks: 'Side decks', Trailerable: 'Trailerable',
    EngineConfiguration: 'Engine configuration', TypicalEngineID: 'Typical engine', FuelCapacity: 'Fuel capacity',
    WaterCapacity: 'Water capacity', HoldingCapacity: 'Holding capacity', Cooling: 'Cooling',
    Berths: 'Berths', Cabins: 'Cabins', Heads: 'Heads', Shower: 'Shower', Galley: 'Galley',
    CoastalRating: 'Coastal rating', OffshoreRating: 'Offshore rating', GreatLoopSuitable: 'Great Loop suitability',
    TypicalMission: 'Typical mission', AvoidIf: 'Avoid if', Construction: 'Construction', KeelType: 'Keel type',
    Strengths: 'Strengths', Weaknesses: 'Weaknesses', CommonProblems: 'Common problems', Features: 'Features',
    DataConfidence: 'Data confidence', ResearchStatus: 'Research status', ResearchNotes: 'Research notes', LastUpdated: 'Last updated', ReviewedBy: 'Reviewed by',
    ImageURL: 'Representative image'
  };

  const unknownTokens = new Set(['unknown', 'not known', 'not researched', 'tbd', 'n/a', 'na', 'not available', 'unverified']);

  function isPresent(value) {
    if (value === false || value === 0) return true;
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized !== '' && !unknownTokens.has(normalized);
    }
    return true;
  }

  function hasRepresentativeImage(model) {
    const value = String(model.ImageURL || '').trim().toLowerCase();
    return Boolean(value) && !value.includes('placeholder') && !value.includes('default-boat') && !value.includes('no-image');
  }

  function auditModel(model) {
    const isIdentityPlaceholder = false;
    const groups = GROUPS.map(group => {
      const missing = group.fields.filter(field => !isPresent(model[field]));
      const complete = group.fields.length - missing.length;
      const percent = Math.round((complete / group.fields.length) * 100);
      return { ...group, missing, complete, percent };
    });
    const score = Math.round(groups.reduce((sum, group) => sum + (group.percent * group.weight / 100), 0));
    const missingFields = groups.flatMap(group => group.missing.map(field => ({ field, label: FIELD_LABELS[field] || field, group: group.label, groupId: group.id })));
    const searchGroup = groups.find(group => group.id === 'search');
    return {
      BoatModelID: model.BoatModelID || '',
      Manufacturer: model.Manufacturer || '',
      Model: model.Model || '',
      Variant: model.Variant || '',
      displayName: [model.Manufacturer, model.Model, model.Variant].filter(Boolean).join(' '),
      score,
      searchScore: searchGroup ? searchGroup.percent : 0,
      missingCount: missingFields.length,
      missingFields,
      groups,
      hasImage: hasRepresentativeImage(model),
      researchStatus: model.ResearchStatus || 'Unknown',
      confidence: model.DataConfidence || 'Unknown',
      auditDisposition: 'Production model',
      actionable: !isIdentityPlaceholder
    };
  }

  function auditModels(models) {
    const records = (Array.isArray(models) ? models : []).map(auditModel).sort((a, b) => a.score - b.score || a.displayName.localeCompare(b.displayName));
    const total = records.length;
    const actionableRecords = records.filter(record => record.actionable);
    const actionableTotal = actionableRecords.length;
    const average = actionableTotal ? Math.round(actionableRecords.reduce((sum, record) => sum + record.score, 0) / actionableTotal) : 0;
    const searchAverage = actionableTotal ? Math.round(actionableRecords.reduce((sum, record) => sum + record.searchScore, 0) / actionableTotal) : 0;
    const complete = records.filter(record => record.score >= 90).length;
    const priority = actionableRecords.filter(record => record.score < 70).length;
    const identityPlaceholders = records.filter(record => !record.actionable).length;
    const missingImages = records.filter(record => !record.hasImage).length;
    const fieldCounts = {};
    actionableRecords.forEach(record => record.missingFields.forEach(item => {
      fieldCounts[item.field] = (fieldCounts[item.field] || 0) + 1;
    }));
    const commonMissing = Object.entries(fieldCounts)
      .map(([field, count]) => ({ field, label: FIELD_LABELS[field] || field, count, percent: total ? Math.round(count / actionableTotal * 100) : 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { generatedAt: new Date().toISOString(), total, actionableTotal, identityPlaceholders, average, searchAverage, complete, priority, missingImages, records, commonMissing, groups: GROUPS };
  }

  return { GROUPS, FIELD_LABELS, isPresent, hasRepresentativeImage, auditModel, auditModels };
});
