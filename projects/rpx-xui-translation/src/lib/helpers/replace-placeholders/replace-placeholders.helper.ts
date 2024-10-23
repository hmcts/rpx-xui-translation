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
export const splitPhraseIntoComponents = (phrase: string, replacements: Replacements): string[] => {
  const result: string[] = [];

  // Iterate over the object keys (replacements) and perform replacements
  Object.keys(replacements).forEach((key) => {
    const placeholder = `%${key}%`; // Construct the placeholder string to search for

    const parts = phrase.split(placeholder); // Split the phrase using the placeholder

    // Clear the result array and process the components
    parts.forEach((part, index) => {
      const trimmedPart = part.trim();

      if (trimmedPart) {
        result.push(trimmedPart); // Add only non-empty parts
      }

      if (index < parts.length - 1) {
        result.push(replacements[key]); // Add the replacement value
      }
    });
    // Join the split parts back to phrase to handle multiple placeholders
    phrase = parts.join(' ').trim();
  });
  return result;
};
