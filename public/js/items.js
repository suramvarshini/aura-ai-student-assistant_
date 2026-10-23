/**
 * Campus Lost and Found System - Item List & Search Script
 * Module for fetching, filtering, searching, and displaying items on index.html.
 */

document.addEventListener('DOMContentLoaded', () => {
  const itemsContainer = document.getElementById('items-grid');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const typeFilter = document.getElementById('type-filter');
  const statusFilter = document.getElementById('status-filter');
  const startDateFilter = document.getElementById('start-date');
  const endDateFilter = document.getElementById('end-date');
  const resetBtn = document.getElementById('reset-filters');

  // Stats Counters
  const totalCountEl = document.getElementById('stat-total');
  const lostCountEl = document.getElementById('stat-lost');
  const foundCountEl = document.getElementById('stat-found');

  let debounceTimer;

  // Load Items with current filter parameters
  async function loadItems() {
    if (!itemsContainer) return;

    itemsContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>🔄 Loading campus items...</p>
      </div>
    `;

    const filters = {
      search: searchInput ? searchInput.value.trim() : '',
      category: categoryFilter ? categoryFilter.value : 'all',
      type: typeFilter ? typeFilter.value : 'all',
      status: statusFilter ? statusFilter.value : 'all',
      startDate: startDateFilter ? startDateFilter.value : '',
      endDate: endDateFilter ? endDateFilter.value : ''
    };

    try {
      const response = await API.getItems(filters);

      if (response.success) {
        renderItemCards(response.data);
        updateStats(response.data);
      } else {
        itemsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--lost-color);">${response.message}</div>`;
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      itemsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--lost-color);">
          <p>⚠️ Unable to connect to server. Please ensure local MongoDB and Node server are running.</p>
        </div>
      `;
    }
  }

  // Update Hero Stats
  function updateStats(items) {
    if (!totalCountEl) return;
    const total = items.length;
    const lost = items.filter(i => i.type === 'lost').length;
    const found = items.filter(i => i.type === 'found').length;

    totalCountEl.textContent = total;
    if (lostCountEl) lostCountEl.textContent = lost;
    if (foundCountEl) foundCountEl.textContent = found;
  }

  // Render Grid Cards
  function renderItemCards(items) {
    if (!itemsContainer) return;

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: white; border-radius: 12px; border: 1px dashed var(--border-color);">
          <p style="font-size: 1.2rem; font-weight: 600; color: var(--secondary-color);">🔍 No items found</p>
          <p style="color: var(--text-muted); margin-top: 5px;">Try adjusting your search keywords or filter options.</p>
        </div>
      `;
      return;
    }

    itemsContainer.innerHTML = items.map(item => {
      const badgeClass = item.status === 'claimed' 
        ? 'badge-claimed' 
        : (item.type === 'lost' ? 'badge-lost' : 'badge-found');

      const statusText = item.status === 'claimed' ? 'Claimed' : (item.type === 'lost' ? 'Lost' : 'Found');

      const tagsHtml = (item.autoTags || [])
        .slice(0, 3)
        .map(t => `<span class="tag">#${escapeHTML(t)}</span>`)
        .join('');

      return `
        <div class="item-card">
          <div class="card-image-container">
            <img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" class="card-image" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=500&auto=format&fit=crop&q=60'">
            <div class="badge-overlay">
              <span class="badge ${badgeClass}">${statusText}</span>
              <span class="badge badge-category">${formatCategory(item.category)}</span>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHTML(item.title)}</h3>
            <p class="card-description">${escapeHTML(item.description)}</p>
            
            <div class="tags-container">
              ${tagsHtml}
            </div>

            <div class="card-meta">
              <div class="card-meta-row">
                <span>📍</span> <span>${escapeHTML(item.location)}</span>
              </div>
              <div class="card-meta-row">
                <span>📅</span> <span>${formatDate(item.date)}</span>
              </div>
            </div>

            <div class="card-footer">
              <a href="item-detail.html?id=${item._id}" class="btn btn-outline" style="width: 100%;">View Details & Claim</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Event Listeners for Live Search & Filters
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadItems, 300);
    });
  }

  [categoryFilter, typeFilter, statusFilter, startDateFilter, endDateFilter].forEach(filterEl => {
    if (filterEl) {
      filterEl.addEventListener('change', loadItems);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = 'all';
      if (typeFilter) typeFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'all';
      if (startDateFilter) startDateFilter.value = '';
      if (endDateFilter) endDateFilter.value = '';
      loadItems();
    });
  }

  // Initial Fetch
  loadItems();
});
