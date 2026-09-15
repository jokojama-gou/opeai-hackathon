// UI exploration with fictional data only. Not a production authorization service.
export function initialState() {
  return { round: 1, trusted: false, answers: [null, null], shared: false, history: [] };
}
export function transition(state, action) {
  const next = structuredClone(state);
  if (action.type === 'answer') {
    if (next.shared || next.answers.includes('decline')) return next;
    if (![0, 1].includes(action.person) || !['once', 'always', 'decline'].includes(action.value)) return next;
    next.answers[action.person] = action.value;
    if (action.value === 'decline') next.answers = ['decline', 'decline'];
    else if (next.answers.every(Boolean)) {
      next.shared = true;
      next.trusted = next.answers.every(answer => answer === 'always');
    }
  } else if (action.type === 'cancel') {
    if (!next.shared && !next.answers.includes('decline')) next.answers[action.person] = null;
  } else if (action.type === 'revoke') {
    next.trusted = false;
  } else if (action.type === 'next') {
    next.history.push({ round: next.round, shared: next.shared });
    next.round++;
    next.answers = [null, null];
    // This fixture represents a completed recording with a clear matching interval.
    next.shared = next.trusted;
  }
  return next;
}
