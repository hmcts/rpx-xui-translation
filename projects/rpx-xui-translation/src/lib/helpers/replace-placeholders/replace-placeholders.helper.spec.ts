import { replacePlaceholders, splitPhraseIntoComponents } from './replace-placeholders.helper';

describe('replacePlaceholders', () => {
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
