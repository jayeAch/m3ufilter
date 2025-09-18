export interface FilterOptions {
  groupsToInclude?: string[];
  channelsToExclude?: string[];
  fileContents: string;
}

export const filterM3u = (options?: FilterOptions): string => {
  return parseFileAsString(options);
};

const parseFileAsString = (options?: FilterOptions): string => {
  // Early return if no filtering needed
  if (shouldAllGroupsBeReturned(options) && noChannelsToExclude(options)) {
    return options.fileContents;
  }

  const fileContentLines = options.fileContents.split("\n");
  const output: string[] = ['#EXTM3U'];
  
  // Pre-compile regex patterns for better performance
  const groupTitlePatterns = [
    /group-title="([^"]*)"/,
    /group-title='([^']*)'/,
    /group-title=([^,\s]+)/
  ];
  
  const channelNamePatterns = [
    /tvg-name="([^"]*)"/,
    /tvg-name='([^']*)'/,
    /tvg-name=([^,\s]+)/
  ];

  // Pre-process exclusion patterns for case-insensitive matching
  const excludedChannelsLower = options?.channelsToExclude?.map(ch => ch.toLowerCase()) || [];
  const includedGroupsSet = new Set(options?.groupsToInclude || []);

  let currentGroup: string | null = null;
  let currentGroupIncluded = false;
  let i = 0;

  while (i < fileContentLines.length) {
    const line = fileContentLines[i].trim();
    
    // Skip empty lines and EXTMLU header
    if (!line || line === '#EXTM3U') {
      i++;
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      // Check channel exclusion first (cheaper check)
      if (excludedChannelsLower.length > 0 && shouldChannelBeExcludedFast(line, excludedChannelsLower, channelNamePatterns)) {
        i += 2; // Skip metadata line and URL line
        currentGroup = null;
        currentGroupIncluded = false;
        continue;
      }

      // Extract group name with optimized function
      currentGroup = extractGroupNameFast(line, groupTitlePatterns);
      
      // Check group inclusion
      currentGroupIncluded = shouldGroupBeIncludedFast(currentGroup, includedGroupsSet);
      
      if (currentGroupIncluded) {
        output.push(line); // Push metadata line
        
        // Push URL line if it exists
        if (i + 1 < fileContentLines.length) {
          output.push(fileContentLines[i + 1].trim());
        }
      }
      
      i += 2; // Skip to next metadata line
      continue;
    }

    // For non-metadata lines in included groups
    if (currentGroupIncluded && line.length > 0) {
      output.push(line);
    }
    
    i++;
  }
  
  return output.join('\n') + '\n';
};

// Optimized helper functions
const shouldAllGroupsBeReturned = (options?: FilterOptions): boolean => {
  return !options?.groupsToInclude || options.groupsToInclude.length === 0;
};

const noChannelsToExclude = (options?: FilterOptions): boolean => {
  return !options?.channelsToExclude || options.channelsToExclude.length === 0;
};

const shouldGroupBeIncludedFast = (group: string, includedGroupsSet: Set<string>): boolean => {
  return includedGroupsSet.size === 0 || (group && includedGroupsSet.has(group));
};

const shouldChannelBeExcludedFast = (
  line: string, 
  excludedChannelsLower: string[], 
  patterns: RegExp[]
): boolean => {
  const channelName = extractParameterFromPatterns(line, patterns) || extractChannelNameFromTitle(line);
  
  if (!channelName) return false;
  
  const channelNameLower = channelName.toLowerCase();
  return excludedChannelsLower.some(excludeKeyword => 
    channelNameLower.includes(excludeKeyword)
  );
};

const extractGroupNameFast = (line: string, patterns: RegExp[]): string => {
  return extractParameterFromPatterns(line, patterns) || "Unknown";
};

const extractParameterFromPatterns = (line: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const extractChannelNameFromTitle = (line: string): string | null => {
  const commaIndex = line.indexOf(',');
  return commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : null;
};
