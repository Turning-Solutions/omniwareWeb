export const normalizeSpecKey = (key: string): string => {
    if (!key) return '';
    // Convert separators (_ - / \) to space, collapse spaces, title case each word, join with underscore
    return key
        .replace(/[_\-\/\\]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('_');
};
