import { PublishConfig } from "./types";

export type PublishRequest = {
  title: string;
  description?: string;
  series?: string;
  canonicalURL?: string;
  config: PublishConfig;
  tags: string[];
  publishStatus: "draft" | "public" | "unlisted";
};
