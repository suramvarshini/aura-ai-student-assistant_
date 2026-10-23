/**
 * Campus Lost and Found System - API Communication Module
 * Encapsulates all backend REST API requests using standard Fetch API.
 */

const API_BASE = '/api';

const API = {
  /**
   * Fetch lost and found items with optional query parameters
   */
  async getItems(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.type) params.append('type', filters.type);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const res = await fetch(`${API_BASE}/items?${params.toString()}`);
    return await res.json();
  },

  /**
   * Fetch single item detail by ID
   */
  async getItemById(id) {
    const res = await fetch(`${API_BASE}/items/${id}`);
    return await res.json();
  },

  /**
   * Submit new lost or found item (FormData for file upload)
   */
  async createItem(formData) {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      body: formData // Content-Type header auto-set by browser for FormData
    });
    return await res.json();
  },

  /**
   * Request category auto-classification for real-time form feedback
   */
  async classifyText(title, description) {
    const res = await fetch(`${API_BASE}/items/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    return await res.json();
  },

  /**
   * Submit claim request for an item
   */
  async createClaim(formData) {
    const res = await fetch(`${API_BASE}/claims`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  },

  /**
   * Admin Login
   */
  async loginAdmin(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  },

  /**
   * Admin: Get all claim requests
   */
  async getClaims(token, status = 'all') {
    const res = await fetch(`${API_BASE}/claims?status=${status}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
  },

  /**
   * Admin: Verify (Approve/Reject) claim request
   */
  async verifyClaim(token, claimId, status, adminNotes) {
    const res = await fetch(`${API_BASE}/claims/${claimId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, adminNotes })
    });
    return await res.json();
  },

  /**
   * Admin: Delete item post
   */
  async deleteItem(token, itemId) {
    const res = await fetch(`${API_BASE}/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
  },

  /**
   * Admin: Update item status manually
   */
  async updateItemStatus(token, itemId, status) {
    const res = await fetch(`${API_BASE}/items/${itemId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    return await res.json();
  }
};
