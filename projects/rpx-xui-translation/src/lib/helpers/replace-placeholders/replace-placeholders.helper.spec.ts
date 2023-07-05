import { replacePlaceholders } from './replace-placeholders.helper';

describe('replacePlaceholders', () => {
  it('should replace placeholders with the correct values', () => {
    const input = 'Hello %FIELDNAME%';
    const replacements = { FIELDNAME: 'John' };
    const expected = 'Hello John';

    const actual = replacePlaceholders(input, replacements);

    expect(actual).toBe(expected);
  });
});
