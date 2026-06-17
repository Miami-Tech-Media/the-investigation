// ============================================
// THE INVESTIGATION — Site Search
// Loads search-index.json once, filters client-side, no server needed.
// ============================================

(function () {
  let INDEX = [];
  let activeIndex = -1;
  let currentResults = [];

  function basePath() {
    // pages inside /reports/ need ../search-index.json, root page needs ./search-index.json
    return window.location.pathname.includes('/reports/') ? '../search-index.json' : 'search-index.json';
  }

  function reportUrl(file) {
    return window.location.pathname.includes('/reports/') ? file : 'reports/' + file;
  }

  function loadIndex() {
    fetch(basePath())
      .then(function (r) { return r.json(); })
      .then(function (data) { INDEX = data; })
      .catch(function () { INDEX = []; });
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(text, query) {
    const escaped = escapeHtml(text);
    const terms = query.trim().split(/\s+/).filter(Boolean).map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    if (terms.length === 0) return escaped;
    const re = new RegExp('(' + terms.join('|') + ')', 'ig');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function snippetAround(text, query) {
    const lower = text.toLowerCase();
    const firstTerm = query.trim().split(/\s+/)[0].toLowerCase();
    const idx = lower.indexOf(firstTerm);
    if (idx === -1) return text.slice(0, 160) + '…';
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + 140);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  }

  function score(entry, terms) {
    let s = 0;
    const titleLower = entry.title.toLowerCase();
    const headingLower = (entry.heading || '').toLowerCase();
    const textLower = entry.text.toLowerCase();
    terms.forEach(function (term) {
      if (titleLower.includes(term)) s += 10;
      if (headingLower.includes(term)) s += 6;
      const matches = textLower.split(term).length - 1;
      s += matches * 2;
    });
    return s;
  }

  function search(query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(function (t) { return t.length > 1; });
    if (terms.length === 0) return [];
    const results = INDEX
      .map(function (entry) { return { entry: entry, score: score(entry, terms) }; })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 8)
      .map(function (r) { return r.entry; });
    return results;
  }

  function renderResults(container, results, query) {
    activeIndex = -1;
    currentResults = results;
    if (results.length === 0) {
      container.innerHTML = '<div class="search-empty">No matches found</div>';
      container.classList.add('open');
      return;
    }
    const rows = results.map(function (r, i) {
      const snippet = snippetAround(r.text, query);
      const headingHtml = r.heading ? '<div class="search-result-heading">' + escapeHtml(r.heading) + '</div>' : '';
      return (
        '<div class="search-result-item" data-index="' + i + '" data-file="' + r.file + '">' +
          '<div class="search-result-top">' +
            '<span class="search-result-title">' + escapeHtml(r.title) + '</span>' +
            '<span class="search-result-tag">' + escapeHtml(r.tag) + '</span>' +
          '</div>' +
          headingHtml +
          '<div class="search-result-snippet">' + highlight(snippet, query) + '</div>' +
        '</div>'
      );
    }).join('');
    const countRow = '<div class="search-meta-row">' + results.length + ' match' + (results.length === 1 ? '' : 'es') + '</div>';
    container.innerHTML = countRow + rows;
    container.classList.add('open');

    Array.prototype.forEach.call(container.querySelectorAll('.search-result-item'), function (el) {
      el.addEventListener('click', function () {
        const file = el.getAttribute('data-file');
        window.location.href = reportUrl(file);
      });
    });
  }

  function initSearch() {
    const input = document.getElementById('site-search-input');
    const resultsBox = document.getElementById('site-search-results');
    if (!input || !resultsBox) return;

    loadIndex();

    input.addEventListener('input', function () {
      const q = input.value;
      if (q.trim().length < 2) {
        resultsBox.classList.remove('open');
        resultsBox.innerHTML = '';
        return;
      }
      const results = search(q);
      renderResults(resultsBox, results, q);
    });

    input.addEventListener('keydown', function (e) {
      const items = resultsBox.querySelectorAll('.search-result-item');
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive(items);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          window.location.href = reportUrl(currentResults[activeIndex].file);
        } else if (currentResults[0]) {
          window.location.href = reportUrl(currentResults[0].file);
        }
      } else if (e.key === 'Escape') {
        resultsBox.classList.remove('open');
        input.blur();
      }
    });

    document.addEventListener('click', function (e) {
      if (!resultsBox.contains(e.target) && e.target !== input) {
        resultsBox.classList.remove('open');
      }
    });

    function updateActive(items) {
      Array.prototype.forEach.call(items, function (el, i) {
        el.classList.toggle('active', i === activeIndex);
      });
      if (items[activeIndex]) {
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initSearch);
})();
