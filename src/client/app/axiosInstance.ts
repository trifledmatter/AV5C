import axios, { AxiosInstance } from "axios";

let axiosInstance: AxiosInstance = createAxiosInstance(
  process.env.SOURCE_IP || "10.0.0.219"
);

function createAxiosInstance(source: string): AxiosInstance {
  return axios.create({
    baseURL: `http://${source}:4000`,
  });
}

export function updateAxiosInstance(newSource: string): void {
  if (!newSource) {
    throw new Error("New source IP must be provided.");
  }
  axiosInstance = createAxiosInstance(newSource);
}

export { axiosInstance };
