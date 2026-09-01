export const extractFromLocaleString = (
  value: string,
  start: number,
  end: number,
) => {
  // Convert the number to a localized string (including commas/periods)
  const localeString = stringToLocaleString(value);

  // Initialize variables for the result and a counter to track numeric characters
  let result = "";
  let numericCount = 0;

  // Iterate over the localized string
  for (let i = 0; i < localeString.length; i++) {
    const char = localeString[i];

    // If the character is a number or decimal point
    if (/[0-9.]/.test(char)) {
      if (numericCount >= start && numericCount < end) {
        result += char;
      }
      numericCount++; // Only increment when counting numeric characters
    } else {
      // If it's a comma, add it to the result only if we're within the selected range
      if (numericCount > start && numericCount <= end) {
        result += char;
      }
    }
  }

  // trim the result to remove any leading commas
  return result
    .split("")
    .reverse()
    .join("")
    .replace(/^,*/, "")
    .split("")
    .reverse()
    .join("");
};

export const stringToLocaleString = (value: string) => {
  if (value === "") return "";
  if (value.includes(".")) {
    const [integer, decimal] = value.split(".");
    return `${parseFloat(integer).toLocaleString()}.${decimal}`;
  } else {
    return parseFloat(value).toLocaleString();
  }
};

export const rawToFormattedIndex = (raw: string, rawIndex: number): number => {
  const formatted = stringToLocaleString(raw);
  let rawCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (rawCount === rawIndex) return i;
    if (/[0-9.]/.test(formatted[i])) rawCount++;
  }
  return formatted.length;
};
