/**
 * Campus Lost and Found System - Item Detail & Claim Request Script
 * Loads single item details and handles ownership claim submission modal.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  const detailContainer = document.getElementById('detail-container');
  const claimModal = document.getElementById('claim-modal');
  const openClaimBtn = document.getElementById('open-claim-modal-btn');
  const closeClaimBtn = document.getElementById('close-claim-modal-btn');
  const claimForm = document.getElementById('claim-form');

  if (!itemId) {
    if (detailContainer) {
      detailContainer.innerHTML = `
        <div style="text-align: center; padding: 50px;">
          <h2>⚠️ Invalid Item ID</h2>
          <p><a href="index.html" class="btn btn-primary" style="margin-top: 15px;">Back to Home</a></p>
        </div>
      `;
    }
    return;
  }

  // Load Item Details from Backend
  async function loadDetail() {
    try {
      const response = await API.getItemById(itemId);

      if (response.success) {
        const item = response.data;
        renderDetailView(item, response.claimCount || 0);
      } else {
        detailContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--lost-color);">${response.message}</div>`;
      }
    } catch (err) {
      console.error('Error fetching item detail:', err);
      detailContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--lost-color);">Failed to load item details.</div>`;
    }
  }

  function renderDetailView(item, claimCount) {
    if (!detailContainer) return;

    const badgeClass = item.status === 'claimed' 
      ? 'badge-claimed' 
      : (item.type === 'lost' ? 'badge-lost' : 'badge-found');

    const statusText = item.status === 'claimed' ? 'Claimed' : (item.type === 'lost' ? 'Lost' : 'Found');
    const tagsHtml = (item.autoTags || []).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join(' ');

    const canClaim = item.status === 'active';

    detailContainer.innerHTML = `
      <div class="detail-grid">
        <div class="detail-image-box">
          <img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=500&auto=format&fit=crop&q=60'">
        </div>

        <div class="detail-info">
          <div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <span class="badge ${badgeClass}">${statusText}</span>
              <span class="badge badge-category">${formatCategory(item.category)}</span>
            </div>
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 10px;">${escapeHTML(item.title)}</h2>
            <div class="tags-container" style="margin-bottom: 15px;">${tagsHtml}</div>
          </div>

          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="font-weight: 600; font-size: 0.9rem; color: var(--secondary-color); margin-bottom: 5px;">Description:</p>
            <p style="color: var(--text-main); white-space: pre-line;">${escapeHTML(item.description)}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
            <div>
              <strong>📍 Location Found/Lost:</strong>
              <p>${escapeHTML(item.location)}</p>
            </div>
            <div>
              <strong>📅 Reported Date:</strong>
              <p>${formatDate(item.date)}</p>
            </div>
          </div>

          <div style="background: var(--primary-light); padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe;">
            <p style="font-weight: 700; color: #1e40af; margin-bottom: 5px;">👤 Reporter Contact Info:</p>
            <p style="font-size: 0.9rem; color: #1e3a8a;">Name: ${escapeHTML(item.contactName)}</p>
            <p style="font-size: 0.9rem; color: #1e3a8a;">Email: <a href="mailto:${escapeHTML(item.contactEmail)}">${escapeHTML(item.contactEmail)}</a></p>
            ${item.contactPhone ? `<p style="font-size: 0.9rem; color: #1e3a8a;">Phone: ${escapeHTML(item.contactPhone)}</p>` : ''}
          </div>

          <div style="margin-top: 10px;">
            ${canClaim ? `
              <button id="trigger-claim-btn" class="btn btn-success" style="width: 100%; padding: 14px; font-size: 1.05rem;">
                ✋ Claim Ownership / Request Verification
              </button>
            ` : `
              <button class="btn btn-secondary" disabled style="width: 100%; padding: 14px;">
                ✅ This item has already been claimed & verified
              </button>
            `}
            <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 8px;">
              ${claimCount > 0 ? `ℹ️ ${claimCount} pending claim request(s) submitted for this item.` : 'No claim requests yet.'}
            </p>
          </div>
        </div>
      </div>
    `;

    // Attach event listener to newly created Claim trigger button
    const triggerBtn = document.getElementById('trigger-claim-btn');
    if (triggerBtn && claimModal) {
      triggerBtn.addEventListener('click', () => {
        const itemIdInput = document.getElementById('claim-item-id');
        if (itemIdInput) itemIdInput.value = item._id;
        claimModal.classList.add('active');
      });
    }
  }

  // Close Modal Handler
  if (closeClaimBtn && claimModal) {
    closeClaimBtn.addEventListener('click', () => {
      claimModal.classList.remove('active');
    });
  }

  // Handle Claim Submission
  if (claimForm) {
    claimForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const claimantName = document.getElementById('claimant-name').value.trim();
      const claimantEmail = document.getElementById('claimant-email').value.trim();
      const claimantPhone = document.getElementById('claimant-phone').value.trim();
      const proofDescription = document.getElementById('proof-description').value.trim();

      if (!claimantName || !claimantEmail || !claimantPhone || !proofDescription) {
        showToast('Please fill in all required claim proof fields.', 'error');
        return;
      }

      const submitBtn = claimForm.querySelector('button[type="submit"]');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Submitting Claim...';

      try {
        const formData = new FormData(claimForm);
        formData.append('itemId', itemId);

        const res = await API.createClaim(formData);

        if (res.success) {
          showToast('Claim submitted successfully! Admin will review your proof.', 'success');
          claimModal.classList.remove('active');
          claimForm.reset();
          loadDetail(); // Reload detail view
        } else {
          showToast(res.message || 'Failed to submit claim', 'error');
        }
      } catch (err) {
        console.error('Claim submit error:', err);
        showToast('Error submitting claim request.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }

  loadDetail();
});
