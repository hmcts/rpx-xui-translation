import { matchCase } from './match-case.helper';

describe('matchCase', () => {
  it('should return the second string with the same case as the first string if the first character is uppercase', () => {
    const result = matchCase('Naddo', 'yes');
    expect(result).toBe('Yes');
  });

  it('should return the second string in lowercase if the first character is lowercase', () => {
    const result = matchCase('naddo', 'YES');
    expect(result).toBe('yes');
  });

  it('should return the second string as is if either string is empty', () => {
    const result1 = matchCase('', 'yes');
    expect(result1).toBe('yes');

    const result2 = matchCase('naddo', '');
    expect(result2).toBe('');
  });
});
