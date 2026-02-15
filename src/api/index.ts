import { obsidianFetch, RequestParams } from "./fetch";
import { normalizePath, Notice, TFile } from "obsidian";
import {
  createHeader,
  createHTMLTOC,
  createMarkdownTOC,
  getImageDimensions,
  getLevelOfHeading,
  parseResponse,
  removeComments
} from "../utils";
import {
  ContentResponse,
  DevtoMeResponse,
  DevtoPublishBody,
  ImageResponse,
  PublishResponse
} from "./response";
import { parser, Tokenizer } from "../parser";
import MdBlogger from "src/main";
import { PublishConfig } from "./types";
import { PublishRequest } from "./request";
import { Markdown } from "src/types";

const devto_url = "https://dev.to/api";
const imgur_url = "https://api.imgur.com/3";

export class PublishAPI {
  private plugin: MdBlogger;
  constructor(plugin: MdBlogger) {
    this.plugin = plugin;
  }

  async validateDevtoToken(token?: string): Promise<boolean> {
    try {
      const request: RequestParams = {
        url: `${devto_url}/users/me`,
        method: "GET",
        headers: this.getDevtoHeaders(token ?? this.plugin.settings.devtoToken)
      };

      const response = await obsidianFetch(request);

      if (response.status === 200) {
        const { data } = parseResponse<DevtoMeResponse>(response.body);
        this.plugin.settings.devtoProfile = data;
        this.plugin.settings.validDevtoKey = true;
        await this.plugin.saveSettings();
      } else {
        this.plugin.settings.validDevtoKey = false;
        this.plugin.settings.devtoProfile = null;
        await this.plugin.saveSettings();
        throw new Error(response.body);
      }

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getContent(
    path: string,
    title: string,
    config: PublishConfig
  ): Promise<ContentResponse | null> {
    let fileName = this.plugin.settings.useFilenameAsTitle
      ? this.plugin.app.vault.getFileByPath(path).basename
      : title;
    let fileContent = await this.plugin.app.vault.adapter.read(path);

    let { html, markdown, rawMarkdown } = await parser(
      new Tokenizer(removeComments(fileContent)).tokenize(),
      this.plugin.app,
      config,
      this.plugin.settings
    );

    console.log(html, markdown, rawMarkdown);

    if (config.devto) {
      markdown = {
        title: `# ${fileName}\n`,
        subtitle: undefined,
        ...markdown
      };
    } else {
      markdown = {
        title: markdown.title ? markdown.title : `# ${fileName}\n`,
        ...markdown
      };
    }

    let firstChild = html.firstChild;
    let heading: HTMLElement;
    let firstChildIsBreak = false;
    let index = 0;

    if (
      firstChild instanceof HTMLElement &&
      firstChild.className === "link-block"
    ) {
      firstChildIsBreak = true;
      firstChild = html.children[1];
    }

    if (firstChild instanceof HTMLElement) {
      let level = getLevelOfHeading(firstChild);
      if (level > 0) {
        if (firstChildIsBreak) {
          html.removeChild(html.firstChild);
          html
            .querySelectorAll(`a[href="#${firstChild.getAttribute("name")}"]`)
            .forEach((element: HTMLAnchorElement) => {
              element.href = `#top`;
            });
        }
        if (level === 1) {
          heading = firstChild;
          index = html.indexOf(heading) + 1;
          let sibling = html.children[index];
          if (
            sibling instanceof HTMLElement &&
            getLevelOfHeading(sibling) > 1
          ) {
            index++;
          }
        } else if (level > 1) {
          heading = html.insertBefore(createHeader(fileName), firstChild);
          index = html.indexOf(heading) + 2;
        }
      } else if (
        firstChild instanceof HTMLElement &&
        firstChild.tagName == "FIGURE"
      ) {
        if (firstChildIsBreak) {
          html
            .querySelectorAll(`a[href="#${firstChild.getAttribute("name")}"]`)
            .forEach((element: HTMLAnchorElement) => {
              element.href = `#top`;
            });
          html.removeChild(html.firstChild);
        }

        heading = html.insertAfter(createHeader(fileName), firstChild);
        index = html.indexOf(heading) + 1;

        let sibling = html.children[index];
        if (sibling instanceof HTMLElement && getLevelOfHeading(sibling) > 1) {
          index++;
        }
      } else {
        heading = html.insertBefore(createHeader(fileName), firstChild);
        index = html.indexOf(heading) + 1;
      }
    }

    heading.setAttribute("name", "top");

    const tocHtml = createHTMLTOC(
      html,
      this.plugin.settings.useNumberedTOC,
      index
    );

    const tocMarkdown = createMarkdownTOC(
      markdown.content,
      this.plugin.settings.useNumberedTOC
    );

    if (this.plugin.settings.createTOC && tocHtml && tocMarkdown) {
      let sibling = html.children[index];
      html.insertBefore(tocHtml, sibling);
      index++;

      markdown.content = tocMarkdown;
    }

    while (this.plugin.settings.ignoreBeginningNewlines) {
      let sibling = html.children[index];

      if (sibling && sibling.className === "obsidian-break") {
        html.removeChild(sibling);
      } else {
        break;
      }
    }

    let links: Record<string, string>;
    if (this.plugin.settings.imgurClientId.length > 0) {
      links = await this.altContent(html);

      for (const [link, url] of Object.entries(links)) {
        markdown.content = markdown.content.replace(new RegExp(link, "g"), url);
        markdown.content = markdown.content.replace(
          new RegExp("_src", "g"),
          "src"
        );
        rawMarkdown = rawMarkdown.replace(new RegExp(link, "g"), url);
      }

      if (markdown.mainImage) {
        markdown.mainImage.url =
          links[markdown.mainImage.url] || markdown.mainImage.url;
      }
    }

    return {
      html: html.innerHTML,
      rawMarkdown,
      markdown
    };
  }

  async publish(
    body: PublishRequest,
    path: string
  ): Promise<PublishResponse | null> {
    let {
      html: content,
      markdown,
      rawMarkdown
    } = await this.getContent(path, body.title, body.config);

    const devto_request: RequestParams = this.plugin.settings.validDevtoKey
      ? {
          url: `${devto_url}/articles`,
          method: "POST",
          headers: this.getDevtoHeaders(this.plugin.settings.devtoToken),
          body: JSON.stringify({
            article: {
              title: body.title,
              body_markdown: markdown.content,
              published: body.publishStatus === "public",
              tags: body.tags,
              series: body.series,
              canonical_url: body.canonicalURL || "",
              main_image: markdown.mainImage ? markdown.mainImage.url : ""
            }
          })
        }
      : null;

    let devtoResponse =
      body.config.devto && devto_request
        ? await obsidianFetch(devto_request)
        : null;

    let devResponse: DevtoPublishBody;
    if (devtoResponse && devtoResponse.status === 201) {
      devResponse = parseResponse<DevtoPublishBody>(devtoResponse.body);
    }

    if (devtoResponse) {
      return {
        data: {
          html: content,
          markdown: rawMarkdown,
          devto: devtoResponse
            ? {
                ...devResponse,
                url:
                  body.publishStatus === "public"
                    ? devResponse.url
                    : "https://dev.to/dashboard"
              }
            : null
        }
      };
    }
  }

  async uploadImage(file: TFile | string, id: number = 0) {
    let binaryData: ArrayBuffer;
    let extension: string;
    if (file instanceof TFile) {
      extension = file.extension;
      binaryData = await this.plugin.app.vault.readBinary(file);
    } else {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const url = new URL(response.url);
      const pathname = url.pathname;
      const match = pathname.match(/\.(png|jpg|jpeg|gif)$/i);
      if (match) {
        extension = match[1];
      } else {
        throw new Error(
          "Invalid image URL: Unable to determine file extension"
        );
      }

      binaryData = await response.arrayBuffer();
    }
    const buffer = Buffer.from(binaryData);

    const idBuffer = Buffer.from(`ID:${id}`);
    const combinedBuffer = Buffer.concat([buffer, idBuffer]);

    const boundary = "----FormBoundaryXYZ";
    const bodyParts: ArrayBuffer[] = [];

    const mimeTypeMap: { [key: string]: string } = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif"
    };
    const mimeType = mimeTypeMap[extension.toLowerCase()];

    const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image_${id}.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    bodyParts.push(new TextEncoder().encode(preamble).buffer);
    bodyParts.push(combinedBuffer.buffer);

    const epilogue = `\r\n--${boundary}--\r\n`;
    bodyParts.push(new TextEncoder().encode(epilogue).buffer);

    const body = concatenateArrayBuffers(bodyParts);

    try {
      const response = await obsidianFetch({
        url: `${imgur_url}/image`,
        method: "POST",
        headers: {
          Authorization: `Client-ID ${this.plugin.settings.imgurClientId}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`
        },
        body: body
      });

      if (response.status >= 200 && response.status < 300) {
        const imageBody = parseResponse<ImageResponse>(response.body);

        if (imageBody.success) {
          return imageBody;
        } else {
          new Notice(response.body);
        }
      } else {
        new Notice(response.body);
      }
    } catch (error) {
      new Notice(error);
    }
  }

  private async altContent(html: HTMLElement): Promise<Record<string, string>> {
    let imageMap: Record<string, number> = {};
    let fileMap = new Map<string, TFile>();
    let dimensionMap: Record<string, string> = {};

    const checkLink = async (
      link: string,
      width: string = "",
      height: string = ""
    ): Promise<string> => {
      let dimensionLink = link + width + height;
      if (dimensionMap[dimensionLink]) {
        return dimensionMap[dimensionLink];
      }

      let file: TFile;
      if (fileMap.has(link)) {
        file = fileMap.get(link);
      } else {
        file = this.plugin.app.vault.getFileByPath(normalizePath(link));
      }

      if (
        (file && ["png", "jpg", "jpeg", "gif"].includes(file.extension)) ||
        !file
      ) {
        try {
          const response = await this.uploadImage(
            file || link,
            imageMap[link] || 0
          );
          if (response) {
            imageMap[link] = imageMap[link] ? imageMap[link] + 1 : 1;
            dimensionMap[link + width + height] = response.data.link;
            return response.data.link;
          }
        } catch (error) {
          console.error(error);
        }
      }

      return link;
    };

    let images = Array.from(html.querySelectorAll("img"));

    for (const image of images) {
      let src = image.getAttribute("_src");
      if (src && image) {
        const width = image.getAttribute("data-width");
        const height = image.getAttribute("data-height");
        const isCodeBlock = image.getAttribute("is-code-block") === "true";
        const link = await checkLink(
          src,
          isCodeBlock ? "" : width || "",
          isCodeBlock ? "" : height || ""
        );

        if (!image.getAttribute("data-width")) {
          const { width, height } = await getImageDimensions(link);

          image.setAttribute("data-width", width.toString());
          image.setAttribute("data-height", height.toString());
          const block = image.parentElement;

          block.style.maxWidth = `${width}px`;
          block.style.maxHeight = `${height}px`;
        }

        image.setAttribute("src", link);
      }
    }

    return dimensionMap;
  }

  private getDevtoHeaders(token: string) {
    return {
      "api-key": token,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }
}

const concatenateArrayBuffers = (buffers: ArrayBuffer[]): ArrayBuffer => {
  const totalLength = buffers.reduce(
    (sum, current) => sum + current.byteLength,
    0
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;

  buffers.forEach((buffer) => {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });

  return result.buffer;
};
