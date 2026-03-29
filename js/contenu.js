/**
 * contenu.js — Gestion des articles / actualités
 * Stockage localStorage : attt_articles
 * Structure article :
 *   { id, titre, resume, corps, photo (url|null), categorie,
 *     acces ('tous'|'membres'), auteurId, auteurLogin, datePublication }
 */
const CONTENU = (() => {
  const KEY = 'attt_articles';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function _save(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr));
    if (typeof DB !== 'undefined') DB.push(KEY, arr);
  }
  function _id() {
    return 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  /** Retourne les articles, optionnellement filtrés */
  function getArticles(filters = {}) {
    let list = _load();
    if (filters.categorie && filters.categorie !== 'tous') {
      list = list.filter(a => a.categorie === filters.categorie);
    }
    if (filters.acces) {
      list = list.filter(a => a.acces === filters.acces);
    }
    /* Tri : plus récents en premier */
    list.sort((a, b) => b.datePublication.localeCompare(a.datePublication));
    return list;
  }

  function getArticle(id) {
    return _load().find(a => a.id === id) || null;
  }

  function addArticle(data) {
    const list = _load();
    const article = {
      id: _id(),
      titre:           data.titre           || '',
      resume:          data.resume          || '',
      corps:           data.corps           || '',
      photo:           data.photo           || null,
      categorie:       data.categorie       || 'autre',
      acces:           data.acces           || 'tous',
      auteurId:        data.auteurId        || '',
      auteurLogin:     data.auteurLogin     || '',
      datePublication: data.datePublication || new Date().toISOString().slice(0, 10)
    };
    list.push(article);
    _save(list);
    return article;
  }

  function updateArticle(id, data) {
    const list = _load();
    const idx  = list.findIndex(a => a.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data, id };
    _save(list);
    return true;
  }

  function deleteArticle(id) {
    const list = _load().filter(a => a.id !== id);
    _save(list);
  }

  return { getArticles, getArticle, addArticle, updateArticle, deleteArticle };
})();
