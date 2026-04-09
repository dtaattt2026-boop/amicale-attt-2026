'use strict';

/**
 * ATTT Amicale — Module Votes
 * Gestion des scrutins, des choix et du dépôt des bulletins
 *
 * ─── Sujet de vote ───
 * { id, titre, description, choices[], eligibleRoles[],
 *   dateDebut, dateFin, minChoix, maxChoix,
 *   status: 'brouillon'|'ouvert'|'clos', creatorId, createdAt }
 *
 * ─── Choix ───
 * { id, label, description, photo }
 *
 * ─── Bulletin ───
 * { id, subjectId, userId, choiceIds[], votedAt }
 */
const VOTES = (() => {
  const K_SUBJECTS = 'attt_vote_subjects';
  const K_BALLOTS  = 'attt_vote_ballots';

  const STATUS = {
    draft:  'brouillon',
    open:   'ouvert',
    closed: 'clos'
  };

  const AVAILABLE_ROLES = [
    { id: 'superviseur', label: 'Direction' },
    { id: 'admin',       label: 'Délégué' },
    { id: 'membre',      label: 'Membre' },
    { id: 'famille',     label: 'Famille' }
  ];

  /* ────────────── Persistance ────────────── */
  function _loadSubjects() {
    try { return JSON.parse(localStorage.getItem(K_SUBJECTS) || '[]'); } catch { return []; }
  }
  function _saveSubjects(list) {
    localStorage.setItem(K_SUBJECTS, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(K_SUBJECTS, list);
  }
  function _loadBallots() {
    try { return JSON.parse(localStorage.getItem(K_BALLOTS) || '[]'); } catch { return []; }
  }
  function _saveBallots(list) {
    localStorage.setItem(K_BALLOTS, JSON.stringify(list));
    if (typeof DB !== 'undefined') DB.push(K_BALLOTS, list);
  }

  /* ────────────── Utilitaires ────────────── */
  function _sid() { return 'vs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function _cid() { return 'vc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function _bid() { return 'vb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  function _normalizeSubject(data) {
    const choices = Array.isArray(data.choices)
      ? data.choices.map(c => ({
          id:          c.id || _cid(),
          label:       (c.label || '').trim(),
          description: (c.description || '').trim(),
          photo:       (c.photo || '').trim()
        })).filter(c => c.label)
      : [];
    return {
      id:            data.id || _sid(),
      titre:         (data.titre || '').trim(),
      description:   (data.description || '').trim(),
      choices,
      eligibleRoles: Array.isArray(data.eligibleRoles) && data.eligibleRoles.length
                       ? data.eligibleRoles : ['master','superviseur','admin','membre'],
      dateDebut:     data.dateDebut || '',
      dateFin:       data.dateFin   || '',
      minChoix:      Math.max(1, parseInt(data.minChoix) || 1),
      maxChoix:      Math.max(1, parseInt(data.maxChoix) || 1),
      status:        [STATUS.draft, STATUS.open, STATUS.closed].includes(data.status)
                       ? data.status : STATUS.draft,
      creatorId:     data.creatorId || '',
      createdAt:     data.createdAt || Date.now()
    };
  }

  /* ────────────── États ────────────── */
  function isActive(subject) {
    if (subject.status !== STATUS.open) return false;
    const now = new Date().toISOString();
    if (subject.dateDebut && now < (subject.dateDebut + 'T00:00:00')) return false;
    if (subject.dateFin   && now > (subject.dateFin   + 'T23:59:59')) return false;
    return true;
  }

  function isEligible(subject, user) {
    if (!user) return false;
    const roles = Array.isArray(subject.eligibleRoles) ? subject.eligibleRoles : [];
    if (!roles.length) return true;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
    return userRoles.some(r => roles.includes(r));
  }

  /* ────────────── Bulletins ────────────── */
  function getBallot(subjectId, userId) {
    return _loadBallots().find(b => b.subjectId === subjectId && b.userId === userId) || null;
  }

  function castVote(subjectId, userId, choiceIds) {
    const subjects = _loadSubjects().map(_normalizeSubject);
    const subject  = subjects.find(s => s.id === subjectId);
    if (!subject)             return { ok: false, error: 'Sujet introuvable' };
    if (!isActive(subject))   return { ok: false, error: 'Ce vote n\'est pas ouvert' };
    if (getBallot(subjectId, userId)) return { ok: false, error: 'Vous avez déjà voté' };
    if (!Array.isArray(choiceIds) || choiceIds.length < subject.minChoix || choiceIds.length > subject.maxChoix)
      return { ok: false, error: `Choisissez entre ${subject.minChoix} et ${subject.maxChoix} option(s)` };
    const validIds = subject.choices.map(c => c.id);
    if (!choiceIds.every(id => validIds.includes(id)))
      return { ok: false, error: 'Choix invalide' };

    const ballots = _loadBallots();
    ballots.push({ id: _bid(), subjectId, userId, choiceIds, votedAt: Date.now() });
    _saveBallots(ballots);
    return { ok: true };
  }

  /* ────────────── Résultats ────────────── */
  function getResults(subjectId) {
    const subject = _loadSubjects().map(_normalizeSubject).find(s => s.id === subjectId);
    if (!subject) return null;
    const ballots     = _loadBallots().filter(b => b.subjectId === subjectId);
    const totalVoters = ballots.length;
    const choices     = subject.choices.map(c => {
      const votes = ballots.filter(b => b.choiceIds.includes(c.id)).length;
      return { ...c, votes, percent: totalVoters > 0 ? Math.round(votes / totalVoters * 100) : 0 };
    }).sort((a, b) => b.votes - a.votes);
    return { subject, totalVoters, choices };
  }

  /* ────────────── CRUD ────────────── */
  function getSubjects() { return _loadSubjects().map(_normalizeSubject); }
  function getSubject(id) { return getSubjects().find(s => s.id === id) || null; }

  function addSubject(data) {
    const list = _loadSubjects();
    const s = _normalizeSubject({ ...data, id: _sid(), createdAt: Date.now() });
    list.push(s);
    _saveSubjects(list);
    return s;
  }

  function updateSubject(id, data) {
    const list = _loadSubjects();
    const idx  = list.findIndex(s => s.id === id);
    if (idx < 0) return null;
    const updated = _normalizeSubject({ ...list[idx], ...data, id });
    list[idx] = updated;
    _saveSubjects(list);
    return updated;
  }

  function deleteSubject(id) {
    _saveSubjects(_loadSubjects().filter(s => s.id !== id));
    _saveBallots(_loadBallots().filter(b => b.subjectId !== id));
  }

  /* ────────────── Stats ────────────── */
  function getStats() {
    const subjects = getSubjects();
    const ballots  = _loadBallots();
    return {
      total:      subjects.length,
      ouverts:    subjects.filter(isActive).length,
      clos:       subjects.filter(s => s.status === STATUS.closed).length,
      totalVotes: ballots.length
    };
  }

  /* ────────────── Méta ────────────── */
  function getStatusMeta(s) {
    return {
      brouillon: { label: 'Brouillon', cls: 'secondary', icon: 'bi-pencil' },
      ouvert:    { label: 'Ouvert',    cls: 'success',   icon: 'bi-check-circle' },
      clos:      { label: 'Clos',      cls: 'dark',      icon: 'bi-lock' }
    }[s] || { label: s, cls: 'secondary', icon: 'bi-question' };
  }

  return {
    getSubjects, getSubject, addSubject, updateSubject, deleteSubject,
    getBallot, castVote,
    getResults, getStats,
    isActive, isEligible,
    getStatusMeta, AVAILABLE_ROLES, STATUS
  };
})();
