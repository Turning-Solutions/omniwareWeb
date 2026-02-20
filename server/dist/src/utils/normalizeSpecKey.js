"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSpecKey = void 0;
const normalizeSpecKey = (key) => {
    if (!key)
        return '';
    // Convert separators (_ - / \) to space, collapse spaces, title case each word, join with underscore
    return key
        .replace(/[_\-\/\\]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('_');
};
exports.normalizeSpecKey = normalizeSpecKey;
