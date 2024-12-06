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
  console.log('phrase, replacements----', phrase, replacements);
  const result: string[] = [];
  const placeholders = Object.keys(replacements).map((key) => `%${key}%`);

  // Regular expression to match all placeholders in the phrase
  const placeholderRegex = new RegExp(placeholders.join('|'), 'g');

  let lastIndex = 0;

  // Helper function to split text into spaces and content
  const splitTextIntoComponents = (text: string): string[] => {
    const components: string[] = [];
    const trimmed = text.trim();

    if (text.startsWith(' ')) {
      components.push(' ');
    } // Leading space
    if (trimmed) {
      components.push(trimmed);
    } // Content (if any)
    if (text.endsWith(' ')) {
      components.push(' ');
    } // Trailing space

    return components;
  };

  // Process the phrase by matching placeholders
  phrase.replace(placeholderRegex, (placeholder, offset) => {
    if (offset > lastIndex) {
      // Add text before the placeholder
      result.push(...splitTextIntoComponents(phrase.slice(lastIndex, offset)));
    }

    // Add the replacement for the placeholder
    const replacementKey = placeholder.slice(1, -1);
    const replacement = replacements[replacementKey]?.trim();
    if (replacement) {
      result.push(replacement);
    }

    lastIndex = offset + placeholder.length; // Update lastIndex
    return ''; // Required by `replace`, but not used here
  });

  // Add any remaining text after the last match
  if (lastIndex < phrase.length) {
    result.push(...splitTextIntoComponents(phrase.slice(lastIndex)));
  }

  console.log('result----', result);
  return result;
};

