/** Buyer-facing reports delegate to the single discovery assessment. */
function generateDecisionReport(context) {
    const root = typeof window !== 'undefined' ? window : globalThis;
    const engine = root.BScoutFilterEngine;
    const profile = context?.userProfile?.SearchSettings || context?.userProfile || {};
    const result = engine && context?.boat ? engine.evaluateBoat(context.boat, profile, context.routes || root.BScoutSearchOrchestrator?.getContext?.().routes || [], {}) : null;
    const a = result?.preference;
    const items = (labels, prefix) => (labels || []).map(feature => ({feature,explanation:prefix+feature}));
    const report = {
        assessment:a || null,
        recommendation:!result ? 'Needs Review' : !result.passes ? 'Poor Match' : !a.total || a.score === null || a.confidenceLevel === 'Low' || a.configurationDependent ? 'Needs Review' : a.score >= 80 && a.confidenceLevel === 'High' ? 'Strong Candidate' : 'Candidate',
        summary:!result ? 'No buyer assessment is available.' : !result.passes ? result.match.explanation : a.explanation,
        matches:items(a?.strengths,'Recorded preference match: '),
        conflicts:!result?.passes && result ? items(result.reasons,'Requirement conflict: ') : items(a?.compromises,'Known preference compromise: '),
        unknowns:items([...(a?.unknowns || []),...(a?.hardUnknowns || [])],'Needs verification: '),
        actions:[], confidence:a?.confidence ?? null, confidenceLevel:a?.confidenceLevel || 'Not assessed',
        evaluationCount:a?.total || 0
    };
    // Reuse the existing next-action builder, fed only the shared assessment.
    // Legacy evaluator interpretations cannot turn soft preferences into hard actions.
    if(typeof root.generateBuyerActions === 'function') {
        const evaluations = [
            ...(a?.preferences || []).map(p=>({feature:p.label,status:p.unknown?'Unknown':p.matched?'Match':'Conflict',requirement:'Preferred',reason:p.unknown?'Preference information is missing.':p.matched?'Recorded preference match.':'Known preference compromise.'})),
            ...(a?.hardUnknowns || []).map(feature=>({feature,status:'Unknown',requirement:'Required',reason:'Required information or applicable configuration needs verification.'})),
            ...(!result?.passes && result ? result.reasons.map(feature=>({feature,status:'Conflict',requirement:'Required',reason:result.match.explanation})) : [])
        ];
        report.actions = root.generateBuyerActions({...context,evaluations});
    }
    return report;
}
if (typeof window !== 'undefined') window.generateDecisionReport = generateDecisionReport;
if (typeof module !== 'undefined' && module.exports) module.exports = {generateDecisionReport};
