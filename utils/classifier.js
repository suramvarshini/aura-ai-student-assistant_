/**
 * Campus Lost and Found System - Classification Engine
 * Academic Module: Rule-based classification engine to automatically categorize
 * and tag items based on keyword analysis of their title and description.
 */

const CATEGORY_KEYWORDS = {
  electronics: [
    'phone', 'iphone', 'samsung', 'android', 'laptop', 'macbook', 'dell', 'hp', 'lenovo',
    'charger', 'airpods', 'earbuds', 'headphones', 'tablet', 'ipad', 'usb', 'pendrive',
    'hard drive', 'powerbank', 'watch', 'smartwatch', 'calculator', 'mouse', 'keyboard', 'camera'
  ],
  documents: [
    'id', 'id card', 'student id', 'passport', 'license', 'driver', 'certificate', 'degree',
    'notebook', 'textbook', 'card', 'credit card', 'debit card', 'hall ticket', 'admit card',
    'assignment', 'file', 'folder', 'receipt', 'wallet'
  ],
  accessories: [
    'ring', 'necklace', 'bracelet', 'jewel', 'glasses', 'spectacles', 'sunglasses', 'key',
    'keys', 'keychain', 'cap', 'hat', 'belt', 'watch', 'ring', 'earring'
  ],
  bags: [
    'backpack', 'bag', 'duffel', 'pouch', 'luggage', 'suitcase', 'handbag', 'tote',
    'laptop bag', 'gym bag', 'satchel'
  ],
  others: [
    'bottle', 'water bottle', 'jacket', 'hoodie', 'coat', 'shoes', 'umbrella', 'helmet',
    'sports', 'racket', 'umbrella', 'towel', 'box'
  ]
};

/**
 * Classifies text into a category and extracts auto-tags
 * @param {string} title 
 * @param {string} description 
 * @returns {object} { suggestedCategory, autoTags }
 */
function classifyItem(title = '', description = '') {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Scoring per category
  const scores = {
    electronics: 0,
    documents: 0,
    accessories: 0,
    bags: 0,
    others: 0
  };

  const detectedTags = new Set();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        scores[category] += 1;
        detectedTags.add(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    }
  }

  // Find highest scoring category
  let maxScore = 0;
  let suggestedCategory = 'others';

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      suggestedCategory = cat;
    }
  }

  // Generate general auto-tags if none detected
  if (detectedTags.size === 0 && title.trim().length > 0) {
    const words = title.trim().split(/\s+/).filter(w => w.length > 3);
    words.forEach(w => detectedTags.add(w.charAt(0).toUpperCase() + w.slice(1)));
  }

  return {
    suggestedCategory,
    autoTags: Array.from(detectedTags)
  };
}

module.exports = { classifyItem, CATEGORY_KEYWORDS };
