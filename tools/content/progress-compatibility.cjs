'use strict';

// Offline prototype. No browser, filesystem, network, storage writes or migration.
function createResolver(mappingDocument, registry, resolutionDocument = { schemaVersion: 1, decisions: [] }) {
  if (mappingDocument?.schemaVersion !== 1 || !Array.isArray(mappingDocument.mappings) ||
      resolutionDocument?.schemaVersion !== 1 || !Array.isArray(resolutionDocument.decisions) ||
      Object.keys(resolutionDocument).sort().join(',') !== 'decisions,schemaVersion') {
    throw new TypeError('Unsupported legacy mapping or resolution document');
  }
  const ids = registry ? new Set(Object.values(registry.bindings || {}).filter(b => b.status === 'active').map(b => b.canonicalId)) : null;
  const key = m => JSON.stringify([m.namespace, m.legacyId, m.source ?? null]);
  const index = new Map();
  for (const row of mappingDocument.mappings) {
    if (!row || typeof row.namespace !== 'string' || typeof row.legacyId !== 'string' ||
        !(row.source === null || typeof row.source === 'string') ||
        !['resolved', 'ambiguous', 'deprecated', 'orphaned', 'pending_review'].includes(row.status) ||
        !Array.isArray(row.candidates) || row.candidates.some(id => typeof id !== 'string') ||
        new Set(row.candidates).size !== row.candidates.length ||
        (row.status === 'resolved' ? row.candidates.length !== 1 || row.canonicalId !== row.candidates[0] : row.canonicalId !== null)) {
      throw new TypeError('Malformed legacy mapping observation');
    }
    const k = key(row);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(structuredClone(row));
  }
  const decisions = new Map();
  for (const row of resolutionDocument.decisions) {
    if (!row || Object.keys(row).sort().join(',') !== 'canonicalId,legacyId,namespace,review,source,status' ||
        typeof row.namespace !== 'string' || typeof row.legacyId !== 'string' ||
        !(row.source === null || typeof row.source === 'string') ||
        !(row.canonicalId === null || typeof row.canonicalId === 'string') ||
        !row.review || Object.keys(row.review).sort().join(',') !== 'reason,reviewer') throw new TypeError('Malformed reviewed resolution');
    const k = key(row), observed = index.get(k);
    if (decisions.has(k) || !observed || !['resolved', 'ambiguous', 'deprecated', 'orphaned', 'pending_review'].includes(row.status) ||
        !row.review || !['reviewer', 'reason'].every(f => typeof row.review[f] === 'string' && row.review[f].trim()) ||
        (row.status === 'resolved' ? !ids?.has(row.canonicalId) || !observed.every(m => m.candidates?.includes(row.canonicalId)) : row.canonicalId !== null)) {
      throw new TypeError('Invalid or unvalidated reviewed resolution');
    }
    decisions.set(k, structuredClone(row));
  }
  return function resolve({ namespace, legacyId, source = null }) {
    if (typeof namespace !== 'string' || typeof legacyId !== 'string' ||
        (source !== null && typeof source !== 'string')) throw new TypeError('Explicit identity required');
    const k = key({ namespace, legacyId, source }), exact = index.get(k) || [];
    if (!exact.length) return { status: 'unresolved', canonicalId: null, candidates: [], reason: 'No exact mapping' };
    const candidates = [...new Set(exact.flatMap(m => [m.canonicalId, ...(m.candidates || [])]).filter(Boolean))].sort();
    const decision = decisions.get(k);
    const result = (status, canonicalId = null, reason = null) => ({ status, canonicalId, candidates,
      ...(reason ? { reason } : {}), ...(decision ? { review: structuredClone(decision.review) } : {}) });
    if (decision) return result(decision.status, decision.status === 'resolved' ? decision.canonicalId : null);
    // Explicit lifecycle restrictions take priority even over a singleton candidate.
    for (const status of ['orphaned', 'deprecated', 'pending_review']) {
      if (exact.some(m => m.status === status)) return result(status, null, 'Mapping requires review');
    }
    if (exact.some(m => m.status === 'ambiguous') || candidates.length > 1) return result('ambiguous', null, 'Explicit selection required');
    if (candidates.length !== 1 || exact.some(m => m.status !== 'resolved' || m.canonicalId !== candidates[0])) return result('unresolved', null, 'Mapping is not resolved');
    if (!ids || !ids.has(candidates[0])) return result('unresolved', null, 'Active canonical target not validated');
    return result('resolved', candidates[0]);
  };
}

// One independent, lossless result per supplied record, even if targets coincide.
function projectRecords(records, resolver) {
  return records.map(record => ({
    identity: { namespace: record.namespace, legacyId: record.legacyId, source: record.source ?? null },
    resolution: resolver(record),
    raw: structuredClone(record),
  }));
}
module.exports = { createResolver, projectRecords };
