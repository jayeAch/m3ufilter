import axios, { AxiosResponse } from "axios";

export interface DownloadResponse {
  data: string;
  headers: {
    "content-type"?: string;
    "content-description"?: string;
    "expires"?: string;
    "cache-control"?: string;
    "content-disposition"?: string;
  };
}

const DESIRED_HEADERS = [
  "content-type",
  "content-description",
  "expires",
  "cache-control",
  "content-disposition",
] as const;

const copyDesiredHeaders = (
  srcHeaders: AxiosResponse["headers"],
  dest: DownloadResponse
): void => {
  DESIRED_HEADERS.forEach((headerName) => {
    const value = srcHeaders[headerName];
    if (value) {
      dest.headers[headerName] = Array.isArray(value) ? value[0] : value.toString();
    }
  });
};

export const download = async (options: {
  url: string;
}): Promise<DownloadResponse> => {
  try {
    const axiosResponse: AxiosResponse = await axios.get(options.url);
    const response: DownloadResponse = {
      data: typeof axiosResponse.data === "string" ? axiosResponse.data : axiosResponse.data.toString(),
      headers: {},
    };
    copyDesiredHeaders(axiosResponse.headers, response);
    return response;
  } catch (error) {
    // Re-throw with context, or handle as needed (e.g., return a default response)
    throw new Error(`Failed to download from ${options.url}: ${error}`);
  }
};
