export const matchCase = (str1: string, str2: string) => {
  if (str1.length === 0 || str2.length === 0) {
    return str2;
  }

  if (str1.charAt(0).toUpperCase() === str1.charAt(0)) {
    return `${str2.charAt(0).toUpperCase()}${str2.slice(1)}`;
  } else {
    return str2.toLowerCase();
  }
};
