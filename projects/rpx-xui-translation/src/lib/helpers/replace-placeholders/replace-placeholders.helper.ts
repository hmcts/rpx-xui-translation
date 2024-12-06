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

  let lastIndex = 0;

  // Helper function to split text into spaces and content
  const splitTextIntoComponents = (text: string): string[] => {
    const components: string[] = [];
    if (text.startsWith(' ')) {
      components.push(' '); // Add leading space
      text = text.trimStart(); // Remove leading spaces
    }
    if (text.endsWith(' ')) {
      text = text.trimEnd(); // Remove trailing spaces
      components.push(text, ' '); // Add trimmed text and trailing space
    } else if (text) {
      components.push(text); // Only add the trimmed text
    }
    return components;
  };

  // Find all matches of placeholders in the phrase
  let match;
  while ((match = placeholderRegex.exec(phrase)) !== null) {
    const placeholder = match[0]; // The matched placeholder (e.g., %CASEREFERENCE%)
    const start = match.index; // Start index of the matched placeholder
    const end = placeholderRegex.lastIndex; // End index of the matched placeholder

    // Add any text before the placeholder
    if (start > lastIndex) {
      const textBeforePlaceholder = phrase.substring(lastIndex, start);
      result.push(...splitTextIntoComponents(textBeforePlaceholder));
    }

    // Replace the placeholder with its corresponding value from replacements
    const replacementKey = placeholder.slice(1, -1); // Remove '%' from the placeholder to get the key (e.g., 'CASEREFERENCE')
    if (replacements[replacementKey]) {
      result.push(replacements[replacementKey].trim());
    }

    // Update the lastIndex to the end of the current match
    lastIndex = end;
  }

  // Add any remaining text after the last match
  if (lastIndex < phrase.length) {
    const remainingText = phrase.substring(lastIndex);
    result.push(...splitTextIntoComponents(remainingText));
  }

  return result;
};

