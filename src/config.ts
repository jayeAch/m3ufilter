import * as path from "path";
import { readFile } from "fs/promises"; // Only need readFile for async I/O

const CONTAINER_CONFIG_PATH = "/etc/m3ufilter";
const DEFAULT_CONFIG_FILE_NAME = "config.json";

export interface ProfileConfig {
  url: string;
  groupsToInclude?: string[];
  channelsToExclude?: string[];
}

export interface ConfigFile {
  filePath?: string;
  profiles: { key: string; value: ProfileConfig }[];
}

const getUserConfigDir = (): string => {
  if (process.platform === "win32") {
    return process.env.APPDATA ?? "";
  } else if (process.platform === "darwin") {
    return `${process.env.HOME ?? ""}/Library/Preferences`;
  } else {
    // Linux/Unix: Use ~/.config per XDG spec (better for config files)
    return `${process.env.HOME ?? ""}/.config`;
  }
};

const getDefaultConfigFilePath = (): string => {
  if (process.env.CONTAINER_ENV === "docker") {
    return CONTAINER_CONFIG_PATH;
  }
  return path.join(getUserConfigDir(), "m3ufilter");
};

const getDefaultConfigFile = (): string => path.join(getDefaultConfigFilePath(), DEFAULT_CONFIG_FILE_NAME);

export const loadConfig = async (options?: {
  configFile?: string;
  log?: boolean; // Optional: Enable/disable logging
}): Promise<ConfigFile> => {
  const configFilePath = options?.configFile ?? getDefaultConfigFile();
  const shouldLog = options?.log ?? true;

  try {
    if (shouldLog) {
      console.log(`Loading config file from: ${configFilePath}`);
    }

    const fileContents = await readFile(configFilePath, "utf-8");
    const parsed = JSON.parse(fileContents) as ConfigFile;

    // Basic structure validation (expand as needed)
    if (!Array.isArray(parsed.profiles)) {
      throw new Error("Invalid config: 'profiles' must be an array");
    }

    parsed.filePath = configFilePath;
    return parsed;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
      if (shouldLog) {
        console.log(`Config file does not exist: '${configFilePath}'. Falling back to empty config.`);
      }
    } else {
      if (shouldLog) {
        console.error(`Failed to load config from '${configFilePath}': ${errorMsg}`);
      }
    }
    return { profiles: [] }; // Graceful fallback
  }
};
