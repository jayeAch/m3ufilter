export interface FilterOptions {
  groupsToInclude?: string[];
  channelsToExclude?: string[];
  fileContents: string;
}

export const filterM3u = (options?: FilterOptions): string => {
  return parseFileAsString(options);
};

const parseFileAsString = (options?: FilterOptions): string => {
  const nothingToDo =
    shouldAllGroupsBeReturned(options) && noChannelsToExclude(options);
  if (nothingToDo) {
    return options.fileContents;
  }
  const isExcludedLine = (line: string) => line.startsWith("#EXTM3U");
  const isMetadataLine = (line: string) => line.startsWith("#EXTINF");
  const fileContentLines = options.fileContents.split("\n");
  const output = ["#EXTM3U"];
  
  let currentGroup: string | null = null;
  let currentGroupIncluded: boolean = false;
  
  for (let i = 0; i < fileContentLines.length; i++) {
    let line = fileContentLines[i].trim();
    try {
      if (isExcludedLine(line)) {
        continue;
      }
      
      if (isMetadataLine(line)) {
        // Check if channel should be excluded first
        if (shouldChannelBeExcluded(line, options?.channelsToExclude)) {
          i++; // Skip the URL line that follows this metadata
          currentGroup = null;
          currentGroupIncluded = false;
          continue;
        }
        
        currentGroup = extractGroupName(line);
        if (currentGroup === null) throw `Group null on line ${i}: ${line}`;
        
        // Check if group should be included
        currentGroupIncluded = shouldGroupBeIncluded(currentGroup, options?.groupsToInclude);
        
        if (currentGroupIncluded) {
          output.push(line); // Push the metadata line
          
          // Push the URL line that follows (if it exists)
          if (i + 1 < fileContentLines.length) {
            const urlLine = fileContentLines[i + 1].trim();
            output.push(urlLine);
          }
        }
        i++; // Skip the URL line since we've already processed it
        continue;
      }
      
      // For non-metadata lines, only push them if we're currently in an included group
      if (currentGroupIncluded && line.length > 0) {
        output.push(line);
      }
      
    } catch (e) {
      throw `Error parsing line ${i}: '${e}'.\nLine: '${line}'.`;
    }
  }
  return convertToStringWithLineBreak(output);
};

const shouldAllGroupsBeReturned = (options?: FilterOptions) => {
  return !options?.groupsToInclude || options.groupsToInclude.length === 0;
};

const noChannelsToExclude = (options?: FilterOptions) => {
  return options?.channelsToExclude?.length === 0;
};

const shouldGroupBeIncluded = (group: string, channelsToInclude?: string[]) => {
  if (channelsToInclude === undefined || channelsToInclude.length === 0)
    return true;
  if (group === "") return false;
  return channelsToInclude.includes(group);
};

const shouldChannelBeExcluded = (
  line: string,
  excludedKeywords?: string[]
): boolean => {
  if (!excludedKeywords || excludedKeywords.length === 0) return false;
  
  // Try to extract channel name using multiple patterns
  const channelName = extractParameterFromRegex(line, /tvg-name="([^"]*)"/) ||
                     extractParameterFromRegex(line, /tvg-name='([^']*)'/) ||
                     extractParameterFromRegex(line, /tvg-name=([^,\s]+)/) ||
                     extractChannelNameFromTitle(line);
  
  // If we found a channel name, check if it contains any excluded keywords
  if (channelName) {
    return excludedKeywords.some(excludeKeyword => 
      channelName.toLowerCase().includes(excludeKeyword.toLowerCase())
    );
  }
  
  return false;
};

const extractGroupName = (line: string) => {
  // Try multiple patterns to extract group title
  const groupTitle = extractParameterFromRegex(line, /group-title="([^"]*)"/) ||
                    extractParameterFromRegex(line, /group-title='([^']*)'/) ||
                    extractParameterFromRegex(line, /group-title=([^,\s]+)/) ||
                    "Unknown";
  
  if (groupTitle === "Unknown") {
    console.warn(`No group-title found for line: ${line}`);
  }
  return groupTitle;
};

const extractParameterFromRegex = (line: string, regexp: RegExp): string | null => {
  const match = line.match(regexp);
  return match ? match[1] : null;
};

const extractChannelNameFromTitle = (line: string): string | null => {
  // Extract channel name from the title part (after the comma)
  const commaIndex = line.lastIndexOf(',');
  if (commaIndex !== -1) {
    return line.substring(commaIndex + 1).trim();
  }
  return null;
};

const convertToStringWithLineBreak = (lines: string[]): string => {
  const linesAsString = lines.join("\n");
  return linesAsString.endsWith("\n")
    ? linesAsString
    : linesAsString.concat("\n");
};
