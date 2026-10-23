/**
 * Campus Lost and Found System - Post Item Script
 * Handles lost/found item submission form, validation, and real-time category auto-classification.
 */

document.addEventListener('DOMContentLoaded', () => {
  const postForm = document.getElementById('post-item-form');
  const titleInput = document.getElementById('item-title');
  const descriptionInput = document.getElementById('item-description');
  const categorySelect = document.getElementById('item-category');
  const imageInput = document.getElementById('item-image');
  const imagePreview = document.getElementById('image-preview');
  const classificationBox = document.getElementById('classification-box');
  const classificationText = document.getElementById('classification-text');

  let classifyDebounce;

  // Real-time classification engine trigger
  async function triggerClassification() {
    const title = titleInput ? titleInput.value.trim() : '';
    const description = descriptionInput ? descriptionInput.value.trim() : '';

    if (title.length < 3 && description.length < 5) {
      if (classificationBox) classificationBox.style.display = 'none';
      return;
    }

    try {
      const res = await API.classifyText(title, description);
      if (res.success && classificationBox && classificationText) {
        const { suggestedCategory, autoTags } = res.data;
        const formattedCat = suggestedCategory.charAt(0).toUpperCase() + suggestedCategory.slice(1);
        const tagsStr = autoTags.length > 0 ? ` (Auto-tags: ${autoTags.map(t => '#' + t).join(', ')})` : '';

        classificationText.innerHTML = `<strong>💡 Auto-Classification Engine:</strong> Category tagged as <strong>${formattedCat}</strong>${tagsStr}`;
        classificationBox.style.display = 'flex';

        // Auto-select category if set to 'auto' or user hasn't overridden
        if (categorySelect && (categorySelect.value === 'auto' || categorySelect.value === '')) {
          categorySelect.value = suggestedCategory;
        }
      }
    } catch (err) {
      console.warn('Auto classification error:', err);
    }
  }

  if (titleInput) {
    titleInput.addEventListener('input', () => {
      clearTimeout(classifyDebounce);
      classifyDebounce = setTimeout(triggerClassification, 300);
    });
  }

  if (descriptionInput) {
    descriptionInput.addEventListener('input', () => {
      clearTimeout(classifyDebounce);
      classifyDebounce = setTimeout(triggerClassification, 300);
    });
  }

  // Image Upload File Preview
  if (imageInput && imagePreview) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          imagePreview.src = evt.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        imagePreview.style.display = 'none';
      }
    });
  }

  // Form Submission Handler
  if (postForm) {
    postForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('item-title').value.trim();
      const type = document.getElementById('item-type').value;
      const category = document.getElementById('item-category').value;
      const description = document.getElementById('item-description').value.trim();
      const location = document.getElementById('item-location').value.trim();
      const date = document.getElementById('item-date').value;
      const contactName = document.getElementById('contact-name').value.trim();
      const contactEmail = document.getElementById('contact-email').value.trim();
      const contactPhone = document.getElementById('contact-phone').value.trim();

      // Client-side Validation
      if (!title || !type || !description || !location || !contactName || !contactEmail) {
        showToast('Please fill in all required fields.', 'error');
        return;
      }

      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(contactEmail)) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      const submitBtn = postForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Submitting Post...';

      try {
        const formData = new FormData(postForm);
        
        // If category was 'auto', pass actual selected or classified category
        if (category === 'auto') {
          const classRes = await API.classifyText(title, description);
          formData.set('category', classRes.data.suggestedCategory);
        }

        const response = await API.createItem(formData);

        if (response.success) {
          showToast('Item posted successfully!', 'success');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1200);
        } else {
          showToast(response.message || 'Failed to submit post', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      } catch (error) {
        console.error('Post item error:', error);
        showToast('Server error while submitting item. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }
});
