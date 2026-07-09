(function () {
  'use strict';

  var STORAGE_KEY = 'fo_loc_overrides_v1';

  var state = {
    data: null,
    overrides: {},
    officialLocations: {},
    activeCat: 'all',
    selectedEquip: null,
    suggestionIndex: -1,
    currentSuggestions: []
  };

  var el = {
    searchInput: document.getElementById('searchInput'),
    clearBtn: document.getElementById('clearBtn'),
    suggestions: document.getElementById('suggestions'),
    catFilter: document.getElementById('catFilter'),
    emptyState: document.getElementById('emptyState'),
    resultsWrap: document.getElementById('resultsWrap'),
    equipTitle: document.getElementById('equipTitle'),
    equipMeta: document.getElementById('equipMeta'),
    resultsBody: document.getElementById('resultsBody'),
    noResults: document.getElementById('noResults'),
    topbarStats: document.getElementById('topbarStats'),
    exportBtn: document.getElementById('exportBtn'),
    importInput: document.getElementById('importInput'),
    toast: document.getElementById('toast')
  };

  function normalize(s) {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function loadOverrides() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.overrides));
    } catch (e) {
      showToast('Não foi possível guardar localmente neste navegador.');
    }
  }

  function getLocation(ref1) {
    var base = state.data.parts[ref1] || {};
    var official = state.officialLocations[ref1] || {};
    var override = state.overrides[ref1] || {};
    return {
      corredor: override.corredor !== undefined ? override.corredor : (official.corredor !== undefined ? official.corredor : base.corredor) || '',
      prateleira: override.prateleira !== undefined ? override.prateleira : (official.prateleira !== undefined ? official.prateleira : base.prateleira) || '',
      divisao: override.divisao !== undefined ? override.divisao : (official.divisao !== undefined ? official.divisao : base.divisao) || '',
      caixa: override.caixa !== undefined ? override.caixa : (official.caixa !== undefined ? official.caixa : base.caixa) || '',
      isOverride: !!state.overrides[ref1]
    };
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.toast.classList.add('hidden');
    }, 2600);
  }

  function init() {
    state.overrides = loadOverrides();

    Promise.all([
      fetch('data.json').then(function (r) { return r.json(); }),
      fetch('locations.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (results) {
      state.data = results[0];
      state.officialLocations = results[1] || {};
      var refCount = Object.keys(state.data.parts).length;
      var equipCount = state.data.equipmentList.length;
      el.topbarStats.textContent = equipCount + ' equipamentos · ' + refCount + ' referências';
      bindEvents();
    }).catch(function (err) {
      el.topbarStats.textContent = 'Erro ao carregar dados';
      console.error(err);
    });
  }

  function bindEvents() {
    el.searchInput.addEventListener('input', onInput);
    el.searchInput.addEventListener('keydown', onKeydown);
    el.searchInput.addEventListener('focus', function () {
      if (el.searchInput.value.trim().length > 0) renderSuggestions(getMatches(el.searchInput.value));
    });
    document.addEventListener('click', function (e) {
      if (!el.suggestions.contains(e.target) && e.target !== el.searchInput) {
        el.suggestions.classList.add('hidden');
      }
    });
    el.clearBtn.addEventListener('click', function () {
      el.searchInput.value = '';
      state.selectedEquip = null;
      el.suggestions.classList.add('hidden');
      renderEmpty();
      el.searchInput.focus();
    });

    el.catFilter.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      Array.prototype.forEach.call(el.catFilter.querySelectorAll('.chip'), function (c) {
        c.classList.remove('active');
      });
      btn.classList.add('active');
      state.activeCat = btn.getAttribute('data-cat');
      if (state.selectedEquip) renderResults(state.selectedEquip);
    });

    el.exportBtn.addEventListener('click', exportOverrides);
    el.importInput.addEventListener('change', importOverrides);
  }

  function getMatches(query) {
    var q = normalize(query);
    if (!q) return [];
    var terms = q.split(/\s+/).filter(Boolean);
    var matches = state.data.equipmentList.filter(function (eq) {
      var hay = normalize(eq.design + ' ' + eq.serie2 + ' ' + eq.serie);
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    matches.sort(function (a, b) {
      return normalize(a.design).indexOf(q) - normalize(b.design).indexOf(q);
    });
    return matches.slice(0, 25);
  }

  function onInput() {
    var q = el.searchInput.value;
    state.suggestionIndex = -1;
    if (!q.trim()) {
      el.suggestions.classList.add('hidden');
      state.selectedEquip = null;
      renderEmpty();
      return;
    }
    var matches = getMatches(q);
    renderSuggestions(matches);
  }

  function onKeydown(e) {
    var items = el.suggestions.querySelectorAll('.suggestion-item');
    if (el.suggestions.classList.contains('hidden') || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.suggestionIndex = Math.min(state.suggestionIndex + 1, items.length - 1);
      highlightSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.suggestionIndex = Math.max(state.suggestionIndex - 1, 0);
      highlightSuggestion(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var idx = state.suggestionIndex >= 0 ? state.suggestionIndex : 0;
      var eq = state.currentSuggestions[idx];
      if (eq) selectEquipment(eq);
    } else if (e.key === 'Escape') {
      el.suggestions.classList.add('hidden');
    }
  }

  function highlightSuggestion(items) {
    Array.prototype.forEach.call(items, function (it, i) {
      it.classList.toggle('active', i === state.suggestionIndex);
    });
  }

  function renderSuggestions(matches) {
    state.currentSuggestions = matches;
    if (matches.length === 0) {
      el.suggestions.innerHTML = '<div class="suggestion-item"><span class="suggestion-name">Sem correspondências</span></div>';
      el.suggestions.classList.remove('hidden');
      return;
    }
    el.suggestions.innerHTML = matches.map(function (eq, i) {
      var plate = eq.serie2 ? eq.serie2 : eq.serie;
      return '<div class="suggestion-item" data-index="' + i + '">' +
        '<span class="suggestion-name">' + escapeHtml(eq.design) + '</span>' +
        '<span class="suggestion-plate">' + escapeHtml(plate) + '</span>' +
        '</div>';
    }).join('');
    el.suggestions.classList.remove('hidden');

    Array.prototype.forEach.call(el.suggestions.querySelectorAll('.suggestion-item'), function (item) {
      item.addEventListener('click', function () {
        var idx = parseInt(item.getAttribute('data-index'), 10);
        var eq = matches[idx];
        if (eq) selectEquipment(eq);
      });
    });
  }

  function selectEquipment(eq) {
    state.selectedEquip = eq;
    el.searchInput.value = eq.design;
    el.suggestions.classList.add('hidden');
    renderResults(eq);
  }

  function renderEmpty() {
    el.emptyState.classList.remove('hidden');
    el.resultsWrap.classList.add('hidden');
    el.noResults.classList.add('hidden');
  }

  function renderResults(eq) {
    var rows = state.data.equipParts.filter(function (r) {
      return r.design === eq.design && r.serie === eq.serie && r.serie2 === eq.serie2;
    });

    if (state.activeCat !== 'all') {
      rows = rows.filter(function (r) {
        var part = state.data.parts[r.ref1];
        return part && part.categoria === state.activeCat;
      });
    }

    var seen = {};
    var uniqueRows = [];
    rows.forEach(function (r) {
      if (!seen[r.ref1]) {
        seen[r.ref1] = true;
        uniqueRows.push(r);
      }
    });

    if (uniqueRows.length === 0) {
      el.emptyState.classList.add('hidden');
      el.resultsWrap.classList.add('hidden');
      el.noResults.classList.remove('hidden');
      return;
    }

    el.emptyState.classList.add('hidden');
    el.noResults.classList.add('hidden');
    el.resultsWrap.classList.remove('hidden');

    el.equipTitle.textContent = eq.design;
    var metaParts = [];
    if (eq.serie2) metaParts.push('<span>Matrícula ' + escapeHtml(eq.serie2) + '</span>');
    if (eq.serie) metaParts.push('<span>Nº interno ' + escapeHtml(eq.serie) + '</span>');
    metaParts.push('<span>' + uniqueRows.length + ' referência' + (uniqueRows.length === 1 ? '' : 's') + '</span>');
    el.equipMeta.innerHTML = metaParts.join('');

    uniqueRows.sort(function (a, b) {
      var pa = state.data.parts[a.ref1], pb = state.data.parts[b.ref1];
      if (pa.categoria !== pb.categoria) return pa.categoria === 'filtro' ? -1 : 1;
      return (pa.design1 || '').localeCompare(pb.design1 || '');
    });

    el.resultsBody.innerHTML = uniqueRows.map(function (r) {
      return buildRow(r);
    }).join('');

    bindRowEvents();
  }

  function buildRow(r) {
    var part = state.data.parts[r.ref1] || {};
    var loc = getLocation(r.ref1);
    var cat = part.categoria || 'outro';
    var catLabel = cat === 'filtro' ? 'Filtro' : (cat === 'oleo' ? 'Óleo' : '');

    return '<tr data-ref1="' + escapeAttr(r.ref1) + '">' +
      '<td><span class="cat-dot ' + cat + '" title="' + catLabel + '"></span></td>' +
      '<td><span class="ref-code">' + escapeHtml(r.ref1) + '</span></td>' +
      '<td class="design-cell">' +
        '<span class="cat-tag ' + cat + '">' + catLabel + '</span><br>' +
        escapeHtml(part.design1 || '') +
      '</td>' +
      '<td class="belongs-cell">' + (cat === 'oleo' ? escapeHtml(formatBelongs(r.design2)) : '<span class="loc-empty">—</span>') + '</td>' +
      '<td>' + escapeHtml(String(r.qtt !== undefined && r.qtt !== '' ? r.qtt : '')) + '</td>' +
      locCell(loc.corredor) +
      locCell(loc.prateleira) +
      locCell(loc.divisao) +
      locCell(loc.caixa) +
      '<td><button class="edit-btn" type="button">Editar</button></td>' +
      '</tr>';
  }

  function locCell(val) {
    if (val) return '<td class="loc-cell">' + escapeHtml(val) + '</td>';
    return '<td class="loc-cell loc-empty">—</td>';
  }

  function bindRowEvents() {
    Array.prototype.forEach.call(el.resultsBody.querySelectorAll('.edit-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var ref1 = tr.getAttribute('data-ref1');
        openEditRow(tr, ref1);
      });
    });
  }

  function openEditRow(tr, ref1) {
    var loc = getLocation(ref1);
    var cells = tr.querySelectorAll('.loc-cell');
    var editTd = tr.querySelector('td:last-child');

    var wrap = document.createElement('div');
    wrap.className = 'loc-edit-row';
    wrap.innerHTML =
      '<input class="loc-input" data-field="corredor" placeholder="Corredor" value="' + escapeAttr(loc.corredor) + '">' +
      '<input class="loc-input" data-field="prateleira" placeholder="Prateleira" value="' + escapeAttr(loc.prateleira) + '">' +
      '<input class="loc-input" data-field="divisao" placeholder="Divisão" value="' + escapeAttr(loc.divisao) + '">' +
      '<input class="loc-input" data-field="caixa" placeholder="Caixa/nível" value="' + escapeAttr(loc.caixa) + '">' +
      '<button class="loc-save" type="button">Guardar</button>';

    var origCells = Array.prototype.slice.call(cells);
    origCells.forEach(function (c) { c.style.display = 'none'; });

    var td = document.createElement('td');
    td.setAttribute('colspan', '4');
    td.appendChild(wrap);
    origCells[0].parentNode.insertBefore(td, origCells[0]);

    editTd.innerHTML = '';
    var saveBtn = wrap.querySelector('.loc-save');
    saveBtn.addEventListener('click', function () {
      var inputs = wrap.querySelectorAll('.loc-input');
      var next = {};
      inputs.forEach(function (inp) {
        next[inp.getAttribute('data-field')] = inp.value.trim();
      });
      state.overrides[ref1] = next;
      saveOverrides();
      showToast('Localização guardada neste navegador.');
      td.remove();
      origCells.forEach(function (c) { c.remove(); });
      var tbody = tr;
      var newRowHtml = buildRow(currentRowData(ref1));
      var temp = document.createElement('tbody');
      temp.innerHTML = newRowHtml;
      tr.replaceWith(temp.firstElementChild);
      bindRowEvents();
    });
  }

  function currentRowData(ref1) {
    var match = state.data.equipParts.find(function (r) {
      return r.ref1 === ref1 && state.selectedEquip &&
        r.design === state.selectedEquip.design &&
        r.serie === state.selectedEquip.serie &&
        r.serie2 === state.selectedEquip.serie2;
    });
    return match || { ref1: ref1, qtt: '' };
  }

  function exportOverrides() {
    var payload = state.overrides;
    var count = Object.keys(payload).length;
    if (count === 0) {
      showToast('Ainda não editou nenhuma localização.');
      return;
    }
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'locations.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(count + ' localização(ões) exportada(s). Substitua o ficheiro locations.json no repositório para atualizar para todos.');
  }

  function importOverrides(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        state.overrides = Object.assign({}, state.overrides, parsed);
        saveOverrides();
        showToast('Localizações importadas com sucesso.');
        if (state.selectedEquip) renderResults(state.selectedEquip);
      } catch (err) {
        showToast('Ficheiro inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function formatBelongs(s) {
    var t = (s || '').trim();
    if (!t) return '';
    var lower = t.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function escapeHtml(s) {
    return (s === undefined || s === null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
