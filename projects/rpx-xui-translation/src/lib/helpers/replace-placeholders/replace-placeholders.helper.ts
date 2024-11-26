import { Replacements } from '../../rpx-translation.service';

export const replacePlaceholders = (input: string, replacements: Replacements) => {
  Object.keys(replacements).forEach((key) => {
    // Ideally use replaceAll here, but that isn't fully compatible with targeted browsers and packaging yet
    const search = `%${key}%`;
    while (input.indexOf(search) !== -1) {
      input = input.replace(search, replacements[key]);
    }
  });

  return input;
};

// Helper method to split the phrase into components, preserving placeholders and text separately
export const splitPhraseIntoComponents = (phrase: string, replacements: Record<string, string>): string[] => {
  const result: string[] = [];
  const placeholders = Object.keys(replacements).map((key) => `%${key}%`);

  // Regular expression to match all placeholders in the phrase
  const placeholderRegex = new RegExp(placeholders.join('|'), 'g');

  // Split the phrase into parts based on the placeholders
  const parts = phrase.split(placeholderRegex);

  // Match placeholders in the phrase for adding their replacement values
  const matches = phrase.match(placeholderRegex) || [];

  // Iterate through parts and matches to build the result array
  parts.forEach((part, index) => {
    const trimmedPart = part.trim();

    if (trimmedPart) {
      result.push(trimmedPart); // Add non-empty text parts
    }

    if (matches[index]) {
      const replacementKey = matches[index].slice(1, -1); // Remove surrounding '%' characters
      result.push(replacements[replacementKey]); // Add the corresponding replacement value
    }
  });

  return result;
};
