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

  const fileContentLines = options.fileContents.split("\n").map(line => line.trim());
  const output: string[] = ['#EXTM3U'];
  
  // Pre-compile regex for attribute extraction
  const attrPattern = /([a-z-]+)=(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g;
  
  // Pre-process exclusion patterns for case-insensitive matching
  const excludedChannelsLower = options?.channelsToExclude?.map(ch => ch.toLowerCase()) || [];
  const includedGroupsSet = new Set(options?.groupsToInclude || []);

  // Pre-build exclusion regex if needed
  const exclusionRegex = excludedChannelsLower.length > 0 
    ? new RegExp(excludedChannelsLower.map(escapeRegExp).join('|'))
    : null;

  let i = 0;

  while (i < fileContentLines.length) {
    const line = fileContentLines[i];
    
    // Skip empty lines and EXTMLU header
    if (!line || line === '#EXTM3U') {
      i++;
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      // Extract group and channel in single pass
      let groupName: string | null = null;
      let channelName: string | null = null;
      let match;
      attrPattern.lastIndex = 0; // Reset for reuse
      while ((match = attrPattern.exec(line)) !== null) {
        const attr = match[1];
        const value = match[2] || match[3] || match[4];
        if (attr === 'group-title') {
          groupName = value;
        } else if (attr === 'tvg-name') {
          channelName = value;
        }
      }

      // Fallback for channel name
      const channelNameFull = channelName || extractChannelNameFromTitle(line);
      
      // Check channel exclusion first (cheaper check)
      let shouldExclude = false;
      if (excludedChannelsLower.length > 0 && channelNameFull) {
        const channelNameLower = channelNameFull.toLowerCase();
        shouldExclude = exclusionRegex ? !!channelNameLower.match(exclusionRegex) : false;
      }
      
      if (shouldExclude) {
        i += 2; // Skip metadata line and URL line
        continue;
      }

      // Fallback for group name
      const finalGroupName = groupName || "Unknown";
      
      // Check group inclusion
      const groupIncluded = shouldGroupBeIncludedFast(finalGroupName, includedGroupsSet);
      
      if (groupIncluded) {
        output.push(line); // Push metadata line
        
        // Push URL line if it exists
        if (i + 1 < fileContentLines.length) {
          output.push(fileContentLines[i + 1]);
        }
      }
      
      i += 2; // Skip to next metadata line
      continue;
    }

    // For non-metadata lines (always include if non-empty)
    if (line.length > 0) {
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

const extractChannelNameFromTitle = (line: string): string | null => {
  const commaIndex = line.indexOf(',');
  return commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : null;
};

const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
