/**
 * Campus Lost and Found System - Admin Dashboard Script
 * Handles admin verification, claim approval/rejection workflows, and post moderation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('adminToken');
  const user = JSON.parse(localStorage.getItem('adminUser') || '{}');

  // Verify Admin Session Token
  if (!token) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Display Admin Info
  const adminNameEl = document.getElementById('admin-user-name');
  if (adminNameEl) adminNameEl.textContent = user.name || 'Admin';

  // Logout Handler
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      showToast('Logged out successfully', 'info');
      setTimeout(() => {
        window.location.href = 'admin-login.html';
      }, 500);
    });
  }

  // Admin Dashboard Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabItemsSection = document.getElementById('tab-items-section');
  const tabClaimsSection = document.getElementById('tab-claims-section');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      if (targetTab === 'items') {
        if (tabItemsSection) tabItemsSection.style.display = 'block';
        if (tabClaimsSection) tabClaimsSection.style.display = 'none';
        loadAdminItems();
      } else {
        if (tabItemsSection) tabItemsSection.style.display = 'none';
        if (tabClaimsSection) tabClaimsSection.style.display = 'block';
        loadAdminClaims();
      }
    });
  });

  // Admin Stats Elements
  const statTotalItems = document.getElementById('admin-stat-total');
  const statActiveItems = document.getElementById('admin-stat-active');
  const statPendingClaims = document.getElementById('admin-stat-pending-claims');
  const statVerifiedClaims = document.getElementById('admin-stat-verified-claims');

  // Load Dashboard Summary Stats
  async function loadDashboardStats() {
    try {
      const itemsRes = await API.getItems();
      const claimsRes = await API.getClaims(token);

      if (itemsRes.success && claimsRes.success) {
        const items = itemsRes.data;
        const claims = claimsRes.data;

        if (statTotalItems) statTotalItems.textContent = items.length;
        if (statActiveItems) statActiveItems.textContent = items.filter(i => i.status === 'active').length;
        if (statPendingClaims) statPendingClaims.textContent = claims.filter(c => c.status === 'pending').length;
        if (statVerifiedClaims) statVerifiedClaims.textContent = claims.filter(c => c.status === 'approved').length;
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }

  // Load Items Management Table
  async function loadAdminItems() {
    const tableBody = document.getElementById('admin-items-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Loading items...</td></tr>`;

    try {
      const res = await API.getItems();
      if (!res.success || res.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No items found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = res.data.map(item => `
        <tr>
          <td>
            <img src="${escapeHTML(item.imageUrl)}" width="45" height="45" style="object-fit: cover; border-radius: 6px;" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'">
          </td>
          <td><strong>${escapeHTML(item.title)}</strong></td>
          <td><span class="badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type.toUpperCase()}</span></td>
          <td>${formatCategory(item.category)}</td>
          <td>${escapeHTML(item.location)}</td>
          <td>
            <select class="form-control status-select" data-id="${item._id}" style="padding: 4px 8px; font-size: 0.85rem;">
              <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="claimed" ${item.status === 'claimed' ? 'selected' : ''}>Claimed</option>
              <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </td>
          <td>
            <button class="btn btn-danger delete-item-btn" data-id="${item._id}" style="padding: 4px 10px; font-size: 0.8rem;">Delete</button>
          </td>
        </tr>
      `).join('');

      // Status Change Listener
      document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const itemId = e.target.getAttribute('data-id');
          const newStatus = e.target.value;
          const res = await API.updateItemStatus(token, itemId, newStatus);
          if (res.success) {
            showToast(`Item status updated to ${newStatus}`, 'success');
            loadDashboardStats();
          } else {
            showToast(res.message || 'Failed to update status', 'error');
          }
        });
      });

      // Delete Listener
      document.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.getAttribute('data-id');
          if (confirm('Are you sure you want to delete this item post and associated claims?')) {
            const res = await API.deleteItem(token, itemId);
            if (res.success) {
              showToast('Item deleted successfully', 'success');
              loadAdminItems();
              loadDashboardStats();
            } else {
              showToast(res.message || 'Delete failed', 'error');
            }
          }
        });
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--lost-color);">Failed to load items</td></tr>`;
    }
  }

  // Load Claims Verification Management Table
  async function loadAdminClaims() {
    const tableBody = document.getElementById('admin-claims-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Loading claim requests...</td></tr>`;

    try {
      const res = await API.getClaims(token);
      if (!res.success || res.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No claim requests found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = res.data.map(claim => {
        const itemTitle = claim.itemId ? claim.itemId.title : 'Deleted Item';
        const claimStatusClass = claim.status === 'approved' ? 'badge-claimed' : (claim.status === 'rejected' ? 'badge-lost' : 'badge-category');

        return `
          <tr>
            <td><strong>${escapeHTML(itemTitle)}</strong></td>
            <td>
              <div><strong>${escapeHTML(claim.claimantName)}</strong></div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(claim.claimantEmail)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(claim.claimantPhone)}</div>
            </td>
            <td style="max-width: 250px;">
              <p style="font-size: 0.85rem; line-height: 1.3;">${escapeHTML(claim.proofDescription)}</p>
              ${claim.proofImage ? `<a href="${escapeHTML(claim.proofImage)}" target="_blank" style="font-size: 0.78rem; color: var(--primary-color);">🖼️ View Proof Image</a>` : ''}
            </td>
            <td><span class="badge ${claimStatusClass}">${claim.status.toUpperCase()}</span></td>
            <td style="font-size: 0.82rem; color: var(--text-muted);">${formatDate(claim.createdAt)}</td>
            <td>
              ${claim.status === 'pending' ? `
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-success verify-claim-btn" data-id="${claim._id}" data-action="approved" style="padding: 4px 10px; font-size: 0.8rem;">Approve</button>
                  <button class="btn btn-danger verify-claim-btn" data-id="${claim._id}" data-action="rejected" style="padding: 4px 10px; font-size: 0.8rem;">Reject</button>
                </div>
              ` : `
                <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(claim.adminNotes || 'Processed')}</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      // Verify (Approve / Reject) Action Handler
      document.querySelectorAll('.verify-claim-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const claimId = e.target.getAttribute('data-id');
          const action = e.target.getAttribute('data-action');
          
          const notes = prompt(`Optional verification notes for claimant (${action}):`, 
            action === 'approved' ? 'Claim verified and item returned to claimant.' : 'Proof description was insufficient.');

          if (notes !== null) {
            const res = await API.verifyClaim(token, claimId, action, notes);
            if (res.success) {
              showToast(`Claim successfully ${action}!`, 'success');
              if (res.notification) {
                console.log(res.notification);
              }
              loadAdminClaims();
              loadDashboardStats();
            } else {
              showToast(res.message || 'Verification action failed', 'error');
            }
          }
        });
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--lost-color);">Failed to load claims</td></tr>`;
    }
  }

  // Initial Load
  loadDashboardStats();
  loadAdminItems();
});
