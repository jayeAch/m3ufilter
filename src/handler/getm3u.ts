import { download, DownloadResponse } from "../downloader";
import { filterM3u } from "../m3uparser";
import { ConfigFile, loadConfig } from "../config";
import { Request, Response } from "express";
import pino from 'pino'; // npm i pino

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Custom error classes
class ValidationError extends Error {}
class NotFoundError extends Error {}
class UpstreamError extends Error {}

// Utility for parsing array params safely (updated to handle broader query types)
const parseArrayParam = (param: unknown): string[] => {
  if (Array.isArray(param)) {
    return param.flat().map(s => String(s).trim()).filter(Boolean);
  } else if (typeof param === 'string') {
    return param.split(',').map(s => s.trim()).filter(Boolean);
  } else if (param === undefined || param === null) {
    return [];
  } else {
    // Fallback for unexpected types (e.g., ParsedQs objects)
    logger.warn({ paramType: typeof param, paramValue: param }, 'Unexpected query param type');
    return [String(param).trim()].filter(Boolean);
  }
};

interface GetM3uCommonArgs {
  groupsToInclude?: string[];
  channelsToExclude?: string[];
}

interface GetM3uUrlArgs extends GetM3uCommonArgs {
  url: string;
  profileKey?: never;
}

interface GetM3uConfigArgs extends GetM3uCommonArgs {
  profileKey: string;
  url?: never;
}

export type GetM3uArgs = GetM3uUrlArgs | GetM3uConfigArgs;

/**
 * Handles GET /m3u requests: Downloads and filters an M3U playlist based on URL or profile.
 * @param options - Request/response objects
 * @throws ValidationError - Invalid params
 * @throws NotFoundError - Missing config profile
 * @throws UpstreamError - Download failure
 * @returns Filtered M3U response
 */
export const handleGetm3u = async (options: {
  req: Request;
  res: Response;
}) => {
  logger.info({ method: options.req.method, url: options.req.url, ip: options.req.ip }, 'M3U request started');

  try {
    const args = parseRequestParams(options.req);
    const filterOptions = getFilterOptionsFromUrlOrConfig(args);
    const serverResponse = await download({ url: filterOptions.url });

    // Quick performance win: Size limit to prevent memory issues (consider streaming for large files)
    if (serverResponse.data.length > 10 * 1024 * 1024) { // 10MB threshold
      throw new UpstreamError('Playlist too large to process');
    }

    const filteredM3uFileContents = filterM3u({
      groupsToInclude: filterOptions.groupsToInclude,
      channelsToExclude: filterOptions.channelsToExclude,
      fileContents: serverResponse.data,
    });

    setHeaders(options.res, serverResponse, filteredM3uFileContents);
    options.res.send(filteredM3uFileContents);

    logger.info({
      url: filterOptions.url,
      groupsCount: filterOptions.groupsToInclude?.length || 0,
      excludesCount: filterOptions.channelsToExclude?.length || 0,
      responseSize: filteredM3uFileContents.length,
    }, 'M3U filtered and sent');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, 'M3U handler failed');
    if (error instanceof ValidationError) {
      return options.res.status(400).json({ error: error.message });
    } else if (error instanceof NotFoundError) {
      return options.res.status(404).json({ error: error.message });
    } else if (error instanceof UpstreamError) {
      return options.res.status(502).json({ error: 'Failed to fetch remote playlist' });
    }
    // Fallback for unclassified errors (e.g., from filterM3u)
    options.res.status(500).json({ error: 'Internal server error' });
  }
};

const setHeaders = (
  res: Response,
  serverResponse: DownloadResponse,
  filteredM3uFileContents: string
) => {
  res.set("Content-Type", serverResponse.headers?.["content-type"] || "application/vnd.apple.mpegurl");
  if (serverResponse.headers?.["content-description"]) {
    res.set("Content-Description", serverResponse.headers["content-description"]);
  }
  if (serverResponse.headers?.["expires"]) {
    res.set("Expires", serverResponse.headers["expires"]);
  }
  if (serverResponse.headers?.["cache-control"]) {
    res.set("Cache-Control", serverResponse.headers["cache-control"]);
  }
  if (serverResponse.headers?.["content-disposition"]) {
    res.set("Content-Disposition", serverResponse.headers["content-disposition"]);
  }
  res.set(
    "Content-Length",
    Buffer.byteLength(filteredM3uFileContents, "utf-8").toString()
  );
};

const parseRequestParams = (req: Request): GetM3uArgs => {
  const urlParam = req.query["url"];
  const profileParam = req.query["profile"];

  if (urlParam && profileParam) {
    throw new ValidationError('Query params must include either "profile" or "url", not both');
  }

  if (typeof urlParam === 'string') {
    // URL validation for security
    try {
      new URL(urlParam);
    } catch {
      throw new ValidationError('Invalid URL provided');
    }

    return {
      url: urlParam,
      channelsToExclude: parseArrayParam(req.query["exclude"]),
      groupsToInclude: parseArrayParam(req.query["groups"]),
    };
  } else if (typeof profileParam === 'string') {
    // Basic profile key sanitization
    if (!/^[a-zA-Z0-9_-]+$/.test(profileParam)) {
      throw new ValidationError('Invalid profile key format');
    }
    return { profileKey: profileParam };
  } else {
    throw new ValidationError('Query params must include either "profile" or "url"');
  }
};

const getFilterOptionsFromUrlOrConfig = (args: GetM3uArgs) => {
  if ('url' in args) {
    return {
      channelsToExclude: parseArrayParam(args.channelsToExclude), // Re-parse to trim
      groupsToInclude: parseArrayParam(args.groupsToInclude), // Re-parse to trim
      url: args.url,
    };
  } else if ('profileKey' in args) {
    const config: ConfigFile = loadConfig();
    const profile = getConfigItem(args.profileKey, config);
    return {
      channelsToExclude: parseArrayParam(profile.channelsToExclude), // Ensure trimmed
      groupsToInclude: parseArrayParam(profile.groupsToInclude), // Ensure trimmed
      url: profile.url,
    };
  }
  // Unreachable due to type guard, but for safety
  throw new ValidationError('Invalid args structure');
};

const getConfigItem = (profileKey: string, configFile: ConfigFile) => {
  const configItem = configFile.profiles.find((profile) => profile.key === profileKey);
  if (!configItem) {
    throw new NotFoundError(`No profile named ${profileKey} found in config`);
  }
  return configItem.value;
};
