// Utility: Convert hex color to rgba string with alpha
export function hexToRgba(hex, alpha = 0.75) {
  // Remove leading '#' if present
  hex = hex.replace(/^#/, "");

  // Parse 3 or 6 digit hex
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    throw new Error("Invalid hex color format");
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Fetch JSON data safely.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Failed to fetch data:", err);
    throw err;
  }
}

export function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
