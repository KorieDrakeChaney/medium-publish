import html2canvas from "html2canvas";
import { App, htmlToMarkdown } from "obsidian";
import { CSSProperties } from "react";
import { HtmlMarkdownContent, Markdown, TOCItem } from "./types";
import { parser } from "./parser";

export const parseResponse = <T>(response: string): T => {
  return JSON.parse(response);
};

export const convertLanguageToValid = (language: string): string => {
  language = language.toLowerCase();
  switch (language) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "sh":
    case "shell":
      return "bash";
    case "py":
      return "python";
    case "c++":
      return "cpp";
    case "cs":
      return "csharp";
    case "rb":
      return "ruby";
    case "kt":
      return "kotlin";
    case "tomi":
      return "ini";
    case "html":
      return "xml";
    case "md":
      return "markdown";
    case "objc":
      return "objectivec";
    case "pl":
      return "perl";
    case "txt":
      return "plaintext";
    case "vb":
      return "vbnet";
    case "yml":
      return "yaml";
    case "rs":
    case "rust":
      return "rust";
    default:
      return language;
  }
};

export const isValidLanguage = (language: string): boolean => {
  switch (language) {
    case "javascript":
    case "typescript":
    case "bash":
    case "python":
    case "java":
    case "c":
    case "cpp":
    case "csharp":
    case "go":
    case "ruby":
    case "swift":
    case "kotlin":
    case "dart":
    case "diff":
    case "graphql":
    case "ini":
    case "java":
    case "json":
    case "less":
    case "lua":
    case "makefile":
    case "xml":
    case "markdown":
    case "objectivec":
    case "perl":
    case "php":
    case "php-template":
    case "plaintext":
    case "python-repl":
    case "r":
    case "scss":
    case "shell":
    case "sql":
    case "vbnet":
    case "wasm":
    case "yaml":
    case "rust":
      return true;
    default:
      return false;
  }
};

export const createLinkElement = (href: string, text: string) => {
  const a = document.createElement("a");
  a.innerText = text;
  a.href = href;
  a.target = text.includes("http") ? "_blank" : "_self";

  return a;
};

export const saveHtmlAsPng = async (
  app: App,
  element: HTMLElement,
  filePath: string,
  targetWidth: number | null,
  scale: number,
  smoothing: boolean,
  onclone?: (doc: Document, element: Element) => void
): Promise<{ width: number; height: number } | null> => {
  try {
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone
    });

    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    if (targetWidth === null) targetWidth = originalWidth;
    const ratio = targetWidth / originalWidth;
    const targetHeight = originalHeight * ratio;

    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;

    const context = resizedCanvas.getContext("2d");

    if (context) {
      if (smoothing) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
      }
      context.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    }

    const dataUrl = resizedCanvas.toDataURL("image/png", 1.0);
    const base64Data = dataUrl.split(",")[1];
    const arrayBuffer = Uint8Array.from(
      Buffer.from(base64Data, "base64")
    ).buffer;

    await app.vault.adapter.writeBinary(filePath, arrayBuffer);

    return { width: targetWidth, height: targetHeight };
  } catch (error) {
    console.error("Error capturing element:", error);
    return null;
  }
};

export const createImage = (src: string, alt: string): HTMLElement => {
  const figure = document.createElement("figure");
  figure.className = "paragraph-image";
  const div = createDiv();
  div.className = "aspectRatioPlaceholder is-locked";
  const picture = createEl("picture");
  div.appendChild(picture);
  figure.appendChild(div);
  const img = new Image();
  const caption = document.createElement("figcaption");
  caption.className = "imageCaption";
  img.setAttribute("_src", src);
  img.alt = alt;
  picture.appendChild(img);
  figure.appendChild(caption);
  return figure;
};

export const createImageMarkdown = (
  src: string,
  alt: string,
  caption?: string
): string => {
  return `![${alt}](${src}${caption ? ` "${caption}"` : ""})`;
};

export const separateImages = (element: HTMLElement): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  let buffer: HTMLElement = createEl("p");
  while (element.firstChild) {
    const child = element.removeChild(element.firstChild);
    if (child instanceof HTMLElement && child.tagName === "FIGURE") {
      if (buffer.innerHTML.length > 0) {
        elements.push(buffer);
        buffer = createEl("p");
      }
      elements.push(child);
    } else {
      buffer.appendChild(child);
    }
  }

  if (buffer.innerHTML.length > 0) {
    elements.push(buffer);
  }

  return elements;
};

export const getImageDimensions = (
  imageSrc: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = imageSrc;
  });
};

export const createHeader = (text: string): HTMLElement => {
  const header = document.createElement("h1");
  header.innerText = text;
  return header;
};

export const ensureEveryElementHasStyle = (
  element: HTMLElement,
  style: CSSProperties
) => {
  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      Object.assign(child.style, style);
      ensureEveryElementHasStyle(child, style);
      if (child.tagName === "STRONG") {
        child.style.fontWeight = "bold";
      }
    }
  }
};

export const createHiddenSpan = (): HTMLElement => {
  const span = document.createElement("span");
  span.innerHTML = "&#8203;";
  return span;
};

export const createHiddenParagraph = (id?: string): HTMLElement => {
  const paragraph = document.createElement("p");
  const span = createHiddenSpan();
  if (id) {
    paragraph.setAttribute("name", id);
  }
  paragraph.appendChild(span);
  return paragraph;
};

export const createSpan = (text: string): HTMLElement => {
  const span = document.createElement("span");
  span.innerText = text;
  return span;
};

const renderTOC = (
  element: HTMLElement,
  items: TOCItem[],
  markdown: string,
  useNumberedList: boolean,
  container?: HTMLElement
): string => {
  items.forEach((item, index) => {
    const span = createEl("span");
    span.appendText(
      "\t".repeat(item.level - 1) +
        `${useNumberedList ? `${index + 1}.` : "-"} `
    );

    let originalId: string;
    let id: string;
    let url: string;

    if (item.element) {
      originalId = item.element.getAttribute("original-id");
      id = item.element.getAttribute("toc-id");
      url = "#" + id;
      item.element.setAttribute("name", id);
      item.element.setAttribute("id", id);
    }

    if (originalId && id && url) {
      const anchorsWithHash = element.querySelectorAll(`a[href*="#"]`);
      Array.from(anchorsWithHash)
        .filter((a) => {
          return (
            a.getAttribute("href").toLowerCase() ===
            `#${originalId.toLowerCase()}`
          );
        })
        .forEach((a) => {
          a.setAttribute("href", url);
        });
    }

    span.appendChild(
      url
        ? createLinkElement(url, item.element.textContent.trim())
        : createSpan("[ ]")
    );

    span.appendText("\n");
    if (container) container.appendChild(span);

    markdown += `\n${
      "\t".repeat(item.level - 1) +
      `${useNumberedList ? `${index + 1}.` : "-"} `
    } ${url ? `[${item.element.textContent.trim()}](${url})` : "[ ]"} `;

    if (item.children.length > 0) {
      markdown = renderTOC(
        element,
        item.children,
        markdown,
        useNumberedList,
        container
      );
    }
  });

  return markdown;
};

export const createTOCItems = (element: HTMLElement, index = 0): TOCItem[] => {
  let stack: TOCItem[] = [];
  let headings: TOCItem[] = [];
  let currentLevel = 0;

  const getId = (level: number) => {
    let id = `${headings.length + 1}`;
    let currentHeading = stack[0];
    for (let i = 1; i < level; i++) {
      if (!currentHeading) {
        break;
      }
      let currentChild =
        currentHeading.children[currentHeading.children.length - 1];
      id += currentHeading.children.length;
      currentHeading = currentChild;
    }

    return id;
  };

  for (let i = index; i < element.children.length; i++) {
    const child = element.children[i];
    if (child instanceof HTMLHeadingElement) {
      const headingContent = child.textContent.trim();
      const headingId = encodeUriComponentWithParentheses(headingContent);
      const level = parseInt(child.tagName[1]);

      if (level === 1 && stack.length > 0) {
        headings.push(stack[0]);
        stack = [];
      }

      const tocItem: TOCItem = {
        level,
        element: child,
        children: []
      };

      if (level > currentLevel) {
        let diff = level - currentLevel - 1;
        for (let i = 0; i < diff; i++) {
          if (stack.length > 0) {
            stack[stack.length - 1].children.push({
              level: currentLevel + i + 1,
              children: []
            });

            stack.push(stack[stack.length - 1].children[0]);
          } else {
            stack.push({
              level: currentLevel + i + 1,
              children: []
            });
          }
        }

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(tocItem);
        }
        stack.push(tocItem);
      } else {
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(tocItem);
        }
        stack.push(tocItem);
      }

      const id = `${getId(level)}-${headingId}`;
      child.setAttribute("original-id", headingId);
      child.setAttribute("toc-id", id);

      currentLevel = level;
    }
  }

  if (stack.length > 0) {
    headings.push(stack[0]);
  }

  return headings;
};

export const createMarkdownTOC = (
  markdown: string,
  useNumberedList: boolean
): string => {
  const element = createDiv();
  element.innerHTML = markdown;

  const headings = createTOCItems(element);

  if (headings.length === 0) return markdown;

  let tocMarkdown = "## Table of Contents\n";

  tocMarkdown = renderTOC(element, headings, tocMarkdown, useNumberedList);

  return `${tocMarkdown}\n\n${element.innerHTML}`;
};

export const createHTMLTOC = (
  element: HTMLElement,
  useNumberedList: boolean,
  index: number
): HTMLElement => {
  const html = createEl("pre");
  let tocMarkdown = "## Table of Contents\n\n";
  const toc = createEl("code");
  toc.innerHTML = `<strong>Table of Contents</strong>\n`;
  html.setAttribute("data-code-block-mode", "0");

  html.appendChild(toc);

  const firstHeader = element.querySelector("h1");
  if (!firstHeader) return html;

  const headings = createTOCItems(element, index);

  renderTOC(element, headings, tocMarkdown, useNumberedList, toc);

  return html;
};

type CharCheckRules = {
  isNumber?: boolean;
  isLetter?: boolean;
  isSpace?: boolean;
  isSpecial?: boolean;
  isUnique?: string;
};

const isNumber = (char: string): boolean => {
  return /\d/.test(char);
};

const isLetter = (char: string): boolean => {
  return /[a-zA-Z]/.test(char);
};

const isSpace = (char: string): boolean => {
  return /\s/.test(char);
};

const isSpecial = (char: string): boolean => {
  return /[!@#$%^&*(),.?":{}|<>]/.test(char);
};

const isUnique = (char: string, unique: string): boolean => {
  return char === unique;
};

export const checkChar = (rules: CharCheckRules, char: string): boolean => {
  if (rules.isNumber && isNumber(char)) return true;
  if (rules.isLetter && isLetter(char)) return true;
  if (rules.isSpace && isSpace(char)) return true;
  if (rules.isSpecial && isSpecial(char)) return true;
  if (rules.isUnique && isUnique(char, rules.isUnique)) return true;
  return false;
};

export const removeComments = (text: string): string => {
  let result = "";

  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    let nextChar = text[i + 1];

    if (char === "%" && nextChar === "%") {
      let commentCursor = i + 2;
      let hasEnd = false;
      for (let j = commentCursor; j < text.length - 1; j++) {
        let char = text[j];
        let nextChar = text[j + 1];
        if (char === "%" && nextChar === "%") {
          commentCursor = j + 1;
          hasEnd = true;
          break;
        }
      }

      if (!hasEnd) {
        commentCursor = text.length;
      }

      i = commentCursor;
    } else {
      result += char;
    }
  }

  return result;
};

export const createMarkdownTable = (rows: string[][]): string => {
  let table = "";

  table += "|" + rows[0].map((cell) => ` ${cell} `).join("|") + "|\n";
  table += "|" + rows[0].map(() => " --- ").join("|") + "|\n";

  for (let i = 1; i < rows.length; i++) {
    table += "|" + rows[i].map((cell) => ` ${cell} `).join("|") + "|\n";
  }

  return table;
};

type Dimension = {
  width: number;
  height?: number;
};

export const dimensionFromString = (dimension: string): Dimension | null => {
  let [width, height] = dimension.split("x").map((d) => parseInt(d));

  if (isNaN(width)) {
    return null;
  }

  if (isNaN(height)) {
    return { width };
  }

  return { width, height };
};

export const getLevelOfHeading = (heading: HTMLElement): number => {
  if (heading instanceof HTMLHeadingElement)
    return parseInt(heading.tagName[1]);

  return 0;
};

export const isImageFile = (
  file: string | undefined,
  extensions = ["png", "jpg", "jpeg", "gif"]
): boolean => {
  return file
    ? extensions.some((extension) => file.endsWith(extension))
    : false;
};

export const encodeUriComponentWithParentheses = (str: string): string =>
  encodeURIComponent(str).replace(/\(/g, "%28").replace(/\)/g, "%29");

export const toggleClass = (
  element: HTMLElement,
  className: string,
  add: boolean
) => {
  if (add) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
};

