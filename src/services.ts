import { PublishAPI } from "./api";
import MdBlogger from "./main";

export type Services = {
  api: PublishAPI;
};

export const createServices = (plugin: MdBlogger): Services => {
  return {
    api: new PublishAPI(plugin)
  };
};
