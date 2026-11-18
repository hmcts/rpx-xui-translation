import { replacePlaceholders, splitPhraseIntoComponents } from './replace-placeholders.helper';

describe('replacePlaceholders', () => {
  it('replaces every occurrence and preserves unknown placeholders', () => {
    expect(replacePlaceholders('%COUNT%/%COUNT%/%UNKNOWN%', { COUNT: '1234' })).toBe('1234/1234/%UNKNOWN%');
  });

  it('removes a placeholder when its replacement is empty', () => {
    expect(replacePlaceholders('A%VALUE%B', { VALUE: '' })).toBe('AB');
  });

  it('leaves the phrase unchanged with no replacement keys', () => {
    expect(replacePlaceholders('Test  phrase', {})).toBe('Test  phrase');
  });

  it('should replace placeholders with the correct values - example 1', () => {
    const input = 'Hello %FIELDNAME%';
    const replacements = { FIELDNAME: 'John' };
    const expected = 'Hello John';

    const actual = replacePlaceholders(input, replacements);

    expect(actual).toBe(expected);
  });

  it('should replace placeholders with the correct values - example 2', () => {
    const input = 'The data entered is not valid for %FIELDLABEL%. Link mark up characters are not allowed in this field';
    const replacements = { FIELDLABEL: 'TextField' };
    const expected = [
      'The data entered is not valid for',
      ' ',
      'TextField',
      '. Link mark up characters are not allowed in this field'
    ];

    const actual = splitPhraseIntoComponents(input, replacements);

    expect(actual).toEqual(expected);
  });

  it('should replace placeholders with the correct values - example 3', () => {
    const input = 'Case #%CASEREFERENCE% has been updated with event: %NAME%';
    const replacements = { CASEREFERENCE: '1708-4384-3055-7194', NAME: 'Deceased details' };
    const expected = [
      'Case #',
      '1708-4384-3055-7194',
      ' ',
      'has been updated with event:',
      ' ',
      'Deceased details'
    ];

    const actual = splitPhraseIntoComponents(input, replacements);
    expect(actual).toEqual(expected);
  });
});

describe('splitPhraseIntoComponents boundaries', () => {
  it('has no components for empty or whitespace-only input', () => {
    expect(splitPhraseIntoComponents('', { NAME: 'Alex' })).toEqual([]);
    expect(splitPhraseIntoComponents('   ', { NAME: 'Alex' })).toEqual([]);
  });

  it('trims replacement values and preserves punctuation and separator components', () => {
    expect(splitPhraseIntoComponents('  Hello %NAME%!  ', { NAME: ' Alex ' }))
      .toEqual(['Hello', ' ', 'Alex', '!']);
  });

  it('preserves an unknown placeholder as source text', () => {
    expect(splitPhraseIntoComponents('Hello %UNKNOWN%', { NAME: 'Alex' })).toEqual(['Hello %UNKNOWN%']);
  });

  it('omits empty and whitespace-only replacement values', () => {
    expect(splitPhraseIntoComponents('A%EMPTY%B%BLANK%C', { EMPTY: '', BLANK: '   ' })).toEqual(['A', 'B', 'C']);
  });

  it('keeps adjacent and repeated replacement components in source order', () => {
    expect(splitPhraseIntoComponents('%FIRST%%LAST%%FIRST%', { FIRST: 'Alex', LAST: 'Jones' }))
      .toEqual(['Alex', 'Jones', 'Alex']);
  });
});
