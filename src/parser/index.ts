// YukiYokaii
import { App, MarkdownView, Notice } from "obsidian";
import {
  checkChar,
  convertLanguageToValid,
  createHiddenParagraph,
  createHiddenSpan,
  createImage,
  createLinkElement,
  createMarkdownTable,
  dimensionFromString,
  encodeUriComponentWithParentheses,
  ensureEveryElementHasStyle,
  isValidLanguage,
  saveHtmlAsPng,
  separateImages,
  toggleClass
} from "../utils";
import { Settings } from "src/settings";
import { HtmlMarkdownContent, Markdown } from "src/types";
import { PublishConfig } from "src/api/types";
import { ImageToken, LinkToken, Token } from "./token";
import { Block, BlockBase, Footnote, List } from "./tokenizer";
export { Tokenizer } from "./tokenizer";

type TokenizerState =
  | "TEXT"
  | "DOLLAR_SIGN"
  | "STRIKE"
  | "EQUALS"
  | "HEADING"
  | "ASTERISK"
  | "UNDER_SCORE"
  | "HYPHENS"
  | "EXCLAMATION"
  | "BACKTICKS"
  | "DOUBLE_QUOTE_CAPTION"
  | "SINGLE_QUOTE_CAPTION"
  | "BACKTICK_CAPTION"
  | "BRACKET"
  | "PARENTHESIS";

export const tokenizeBlock = (
  markdown: string,
  isCode: boolean = false
): Token[] => {
  const tokens: Token[] = [];

  let lines = markdown.split("\n");

  let state: TokenizerState = "TEXT";
  let buffer = "";
  let isImage = false;
  let index = 0;
  let currentToken: Token | null = null;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      tokens.push({
        type: "text",
        text: buffer
      });
      buffer = "";
    }
  };

  let openTokens: Token[] = [];

  const pushAndAdd = (token: Token) => {
    tokens.push(token);
    openTokens.push(token);
  };

  const closeToken = (token: Token) => {
    let index = openTokens.findIndex(
      (openToken) => openToken.type === token.type
    );

    const tokensToReopen: Token[] = [];
    const newOpenTokens: Token[] = [];

    for (let i = openTokens.length - 1; i >= 0; i--) {
      if (i >= index) {
        tokens.push(openTokens[i]);

        if (i !== index) {
          tokensToReopen.push(openTokens[i]);
        }
      }

      if (i !== index) {
        newOpenTokens.push(openTokens[i]);
      }
    }

    tokens.push(...tokensToReopen);
    openTokens = newOpenTokens.reverse();
  };

  while (true) {
    if (index >= lines.length) {
      break;
    }

    let cursor = 0;

    let line = lines[index];

    while (cursor < line.length + 1) {
      let char = cursor > line.length ? null : line[cursor];
      let nextChar = cursor + 1 > line.length ? null : line[cursor + 1];
      switch (state) {
        case "TEXT":
          switch (char) {
            case "$":
              flushBuffer();
              state = "DOLLAR_SIGN";
              break;
            case "*":
              flushBuffer();
              state = "ASTERISK";
              break;
            case "_":
              flushBuffer();
              state = "UNDER_SCORE";
              break;
            case "\\":
              if (nextChar) {
                buffer += nextChar;
                cursor++;
              }
              break;
            case "`":
              if (!isCode) {
                flushBuffer();
                state = "BACKTICKS";
              } else {
                buffer += "`";
              }
              break;
            case "~":
              flushBuffer();
              state = "STRIKE";
              break;
            case "=":
              flushBuffer();
              state = "EQUALS";
              break;
            case "!":
              flushBuffer();
              state = "EXCLAMATION";
              break;
            case "[":
              flushBuffer();
              state = "BRACKET";
              break;

            default:
              if (char) {
                buffer += char;
              } else {
                flushBuffer();
              }
              break;
          }
          break;
        case "DOLLAR_SIGN":
          {
            let hasEnd = false;
            let mathCursor = cursor;
            for (let i = cursor; i < line.length; i++) {
              if (line[i] === "$") {
                mathCursor = i;
                hasEnd = true;
                break;
              }
            }

            if (hasEnd) {
              let content = line.slice(cursor, mathCursor);
              tokens.push({
                type: "math",
                content
              });
              cursor = mathCursor;
              state = "TEXT";
            } else {
              cursor -= 1;
              buffer += "$";
            }
          }

          break;
        case "STRIKE":
        case "EQUALS":
          {
            let count = 1;
            for (let i = cursor; i < line.length; i++) {
              if (line[i] === (state == "EQUALS" ? "=" : "~")) {
                count++;
              } else {
                break;
              }
            }

            let foundMark =
              openTokens.findIndex(
                (token) => token.type === (state == "EQUALS" ? "mark" : "del")
              ) !== -1;

            let nextChar = line[cursor + count - 1];

            let hasCharacters =
              (nextChar !== " " && nextChar !== "\t" && nextChar) ||
              char === " ";

            if (count > 1 && (hasCharacters || foundMark)) {
              if (foundMark) {
                closeToken({
                  type: state == "EQUALS" ? "mark" : "del"
                });
              } else {
                pushAndAdd({
                  type: state == "EQUALS" ? "mark" : "del"
                });
              }
            } else {
              buffer += (state == "EQUALS" ? "=" : "~").repeat(count - 1);
            }
            cursor += count - 2;
            state = "TEXT";
          }
          break;
        case "BACKTICKS": {
          let count = 1;
          for (let i = cursor; i < line.length; i++) {
            if (line[i] === "`") {
              count++;
            } else {
              break;
            }
          }

          let hasEnd = false;
          let backtickCursor = cursor + count - 1;
          for (let i = backtickCursor; i < line.length; i++) {
            let char = line[i];

            if (char === "`") {
              let backCount = 1;

              for (let j = i + 1; j < line.length; j++) {
                if (line[j] === "`") {
                  backCount++;
                } else {
                  break;
                }
              }

              if (backCount == count) {
                hasEnd = true;
                cursor = i;
                break;
              } else {
                i += backCount - 1;
              }
            }
          }

          if (!hasEnd) {
            cursor = line.length + 1;
          }
        }
        case "BRACKET": {
          if (char === "[") {
            let wikiLinkCursor = cursor + 1;

            for (let i = wikiLinkCursor; i < line.length; i++) {
              if (line[i] === "]" && line[i + 1] === "]") {
                wikiLinkCursor = i + 1;
                break;
              }
            }

            if (wikiLinkCursor !== cursor + 1) {
              let alt = line.slice(cursor + 1, wikiLinkCursor - 1);
              let dimension;

              for (let i = alt.length - 1; i >= 0; i--) {
                if (alt[i] === "|") {
                  dimension = dimensionFromString(alt.slice(i + 1));
                  if (dimension) {
                    alt = alt.slice(0, i);
                  }
                  break;
                }
              }

              if (isImage) {
                tokens.push({
                  type: "image",
                  alt,
                  caption: null,
                  url: alt,
                  dimensions: dimension
                });
                isImage = false;
              } else {
                alt = alt.replace(/\^/g, "");
                tokens.push({
                  type: "link",
                  text: alt.replace(/\^/g, ""),
                  url: alt
                });
              }

              cursor = wikiLinkCursor;
              state = "TEXT";
            } else {
              buffer += "[";
              state = "TEXT";
              cursor--;
            }

            break;
          }
          if (char === "^") {
            let footnoteCursor = cursor + 1;
            let hasEnd = false;

            for (let i = footnoteCursor; i < line.length; i++) {
              if (line[i] === "]") {
                hasEnd = true;
                footnoteCursor = i;
                break;
              }
            }

            let footnoteUrl = line.slice(cursor + 1, footnoteCursor);

            if (hasEnd) {
              let content = line.slice(footnoteCursor + 2);
              let footnoteIndex = index;
              for (let i = footnoteIndex + 1; i < lines.length; i++) {
                let hasCharacters = false;
                if (lines[i].startsWith("  ")) {
                  hasCharacters = true;
                  content += "\n";
                  content += lines[i].trim();
                  footnoteIndex = i;
                }

                if (!hasCharacters) {
                  break;
                }
              }

              tokens.push({
                type: "footnoteUrl",
                id: footnoteUrl
              });
              cursor = footnoteCursor;
            } else {
              buffer += "[^";
              cursor--;
            }

            state = "TEXT";
            break;
          }
          let urlCursor = cursor;

          for (let i = urlCursor; i < line.length; i++) {
            if (line[i] === "]") {
              urlCursor = i;
              break;
            }
          }

          if (
            urlCursor === cursor &&
            line[urlCursor] !== "]" &&
            line[urlCursor + 1] !== "("
          ) {
            buffer += "[";
            state = "TEXT";
            cursor--;
            break;
          }

          let alt = line.slice(cursor, urlCursor);
          let dimension;

          for (let i = alt.length - 1; i >= 0; i--) {
            if (alt[i] === "|") {
              dimension = dimensionFromString(alt.slice(i + 1));
              if (dimension) {
                alt = alt.slice(0, i);
              }
              break;
            }
          }

          if (isImage) {
            currentToken = {
              type: "image",
              caption: null,
              alt,
              url: "",
              dimensions: dimension
            };
          } else {
            currentToken = {
              type: "link",
              text: alt.replace(/\^/g, ""),
              url: ""
            };
          }
          state = "PARENTHESIS";
          cursor = urlCursor + 1;
          break;
        }
        case "EXCLAMATION":
          if (char === "[") {
            state = "BRACKET";
            isImage = true;
          } else {
            buffer += "!";
            state = "TEXT";
            cursor--;
          }
          break;
        case "PARENTHESIS": {
          let urlEndCursor = cursor;
          for (let i = urlEndCursor; i < line.length; i++) {
            if (line[i] === ")") {
              urlEndCursor = i;
              break;
            }
          }

          state = "TEXT";

          if (urlEndCursor === cursor && line[urlEndCursor] !== ")") {
            buffer += `[${
              (currentToken as ImageToken).alt ||
              (currentToken as LinkToken).text
            }](`;
            cursor--;
            break;
          }

          if (currentToken.type === "image") {
            for (let i = cursor; i < urlEndCursor; i++) {
              const quoteMatch = line[i].match(/["'`]/);
              if (quoteMatch) {
                switch (quoteMatch[0]) {
                  case '"':
                    state = "DOUBLE_QUOTE_CAPTION";
                    break;
                  case "'":
                    state = "SINGLE_QUOTE_CAPTION";
                    break;
                  case "`":
                    state = "BACKTICK_CAPTION";
                    break;
                }
                urlEndCursor = i;
                break;
              }
            }
          }

          let url = line.slice(cursor, urlEndCursor).split(" ");

          if (currentToken) {
            switch (currentToken.type) {
              case "image":
                (currentToken as ImageToken).url = url[0];
                break;
              case "link":
                (currentToken as LinkToken).url = url[0];
                break;
            }

            if (state === "TEXT") {
              tokens.push(currentToken);
              isImage = false;
              currentToken = null;
            }
          }
          cursor = urlEndCursor;
          break;
        }
        case "DOUBLE_QUOTE_CAPTION":
        case "SINGLE_QUOTE_CAPTION":
        case "BACKTICK_CAPTION": {
          let target;
          switch (state) {
            case "DOUBLE_QUOTE_CAPTION":
              target = '"';
              break;
            case "SINGLE_QUOTE_CAPTION":
              target = "'";
              break;
            case "BACKTICK_CAPTION":
              target = "`";
              break;
          }

          let captionEndCursor = cursor;

          for (let i = cursor; i < line.length; i++) {
            if (line[i] === target) {
              captionEndCursor = i;
              break;
            }
          }

          if (
            captionEndCursor === cursor &&
            line[captionEndCursor] !== target
          ) {
            state = "PARENTHESIS";
            cursor--;
            break;
          }

          let caption = line.slice(cursor, captionEndCursor);

          for (let i = captionEndCursor; i < line.length; i++) {
            if (line[i] === ")") {
              captionEndCursor = i;
              break;
            }
          }

          if (currentToken) {
            if (currentToken.type === "image") {
              currentToken.caption = caption;

              tokens.push(currentToken);
              currentToken = null;
            }
          }

          state = "TEXT";
          cursor = captionEndCursor;
          break;
        }
        case "ASTERISK":
        case "UNDER_SCORE": {
          let count = 1;
          let target = state === "ASTERISK" ? "*" : "_";

          for (let i = cursor; i < line.length; i++) {
            if (line[i] === target) {
              count++;
            } else {
              break;
            }
          }

          let foundItalic =
            openTokens.findIndex((token) => token.type === "em") !== -1;
          let foundBold =
            openTokens.findIndex((token) => token.type === "strong") !== -1;

          let extraTarget = count > 3 ? (count % 3 == 0 ? 3 : count % 3) : 0;
          let extras = count > 3 ? 3 : count;
          let nextChar = line[cursor + count - 1];
          let prevChar = cursor > 0 ? line[cursor - 2] : null;

          let hasCharacters =
            (nextChar !== " " && nextChar !== "\t" && nextChar) || char === " ";

          switch (extras) {
            case 3:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "em"
                  });
                } else {
                  buffer += target;
                }

                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "strong"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else {
                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "strong"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
                if (hasCharacters) {
                  pushAndAdd({
                    type: "em"
                  });
                } else {
                  buffer += target;
                }
              }

              break;
            case 2:
              if (foundBold) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "em"
                  });
                } else {
                  buffer += target;
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "em"
                });
              } else {
                buffer += target;
              }
              break;
          }

          switch (extraTarget) {
            case 3:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "em"
                });
              } else {
                buffer += target;
              }
              break;
            case 2:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "em"
                });
              } else {
                buffer += target;
              }
              break;
          }

          state = "TEXT";
          cursor += count - 2;
          break;
        }
      }

      cursor++;
    }

    for (let i = openTokens.length - 1; i >= 0; i--) {
      tokens.push(openTokens[i]);
    }

    openTokens = [];

    index++;
  }

  return tokens;
};

const superscriptMap: { [key: string]: string } = {
  "0": "\u2070",
  "1": "\u00B9",
  "2": "\u00B2",
  "3": "\u00B3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079"
};

export const parser = async (
  blocks: Block[],
  app: App,
  config: PublishConfig,
  appSettings: Settings,
  rawMarkdown: string = "",
  container: HTMLElement = createDiv(),
  createTOC: boolean = true
): Promise<HtmlMarkdownContent> => {
  let markdown: Markdown = {
    content: ""
  };

  let tocMarkdown = "# Table of Contents\n";

  const currentDocument = document.querySelector(
    ".workspace-leaf.mod-active .workspace-leaf-content .view-content .markdown-source-view .cm-content"
  ) as HTMLElement;

  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
  const currentValue = markdownView.editor.getValue();

  let footnoteMap: Record<string, string> = {};
  let footnotes: Record<string, Footnote & BlockBase> = {};

  const setId = (block: Block) => {
    const { lastChild: child } = container;

    if (block.id) {
      if (
        child instanceof HTMLElement &&
        child.className === "obsidian-break"
      ) {
        child.className = "link-block";
        child.setAttribute("name", block.id);
      } else {
        const paragraph = createHiddenParagraph(block.id);
        paragraph.className = "link-block";
        container.appendChild(paragraph);
        markdown.content += `<a id="${block.id}"></a>\n`;
      }
    }
  };

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    switch (block.type) {
      case "content": {
        setId(block);

        const paragraph = document.createElement("p");

        rawMarkdown +=
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            paragraph,
            footnoteMap,
            markdown
          ) + "\n";

        const elements = separateImages(paragraph);

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          container.appendChild(element);
        }

        break;
      }
      case "heading": {
        const heading = document.createElement(`h${block.level}`);

        let validId = false;
        let idIndex = -1;
        for (let i = block.content.length - 1; i >= 0; i--) {
          if (
            checkChar(
              { isLetter: true, isNumber: true, isUnique: "-" },
              block.content[i]
            )
          ) {
            validId = true;
          } else if (block.content[i] === "^") {
            idIndex = i;
            break;
          }
        }

        if (validId && idIndex !== -1) {
          let id = encodeUriComponentWithParentheses(
            block.content.slice(idIndex + 1)
          );
          heading.setAttribute("name", id);
          heading.setAttribute("id", id);
          block.content = block.content.slice(0, idIndex);
        } else {
          const id = encodeURIComponent(block.content);
          heading.setAttribute("name", id);
          heading.setAttribute("id", id);
        }

        rawMarkdown +=
          "#".repeat(block.level) +
          " " +
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            heading,
            footnoteMap
          ) +
          "\n";

        container.appendChild(heading);

        markdown.content += heading.outerHTML + "\n";

        tocMarkdown += `${"  ".repeat(block.level - 1)}- [${
          heading.textContent
        }](#${encodeUriComponentWithParentheses(heading.innerText.trim())})\n`;

        break;
      }
      case "list": {
        setId(block);
        const p = document.createElement("p");
        const list = document.createElement(block.ordered ? "ol" : "ul");

        const item = document.createElement("li");
        if (block.number) item.setAttribute("value", block.number.toString());

        for (const child of block.children) {
          let scope = " ".repeat(child.scope * 4);

          if (child.type === "list") {
            const childList = document.createElement(
              child.ordered ? "ol" : "ul"
            );
            const { rawMarkdown: newRawMarkdown, markdown: newMarkdown } =
              await parser(
                [child],
                app,
                config,
                appSettings,
                rawMarkdown,
                childList,
                false
              );

            markdown.content = newMarkdown.content;
            rawMarkdown = newRawMarkdown;

            item.appendChild(childList);
          } else {
            let lines = child.content.split("\n");
            let preface = `${block.ordered ? block.number + ". " : "- "}`;

            for (let i = 0; i < lines.length; i++) {
              let line = lines[i];
              const newRawMarkdown = parseBlock(
                tokenizeBlock(line),
                app,
                appSettings,
                item,
                footnoteMap
              );

              let content =
                scope + (i === 0 ? preface : "") + newRawMarkdown + "\n";
              markdown.content += content;
              rawMarkdown += content;

              if (i !== lines.length - 1) {
                item.appendChild(document.createElement("br"));
              }
            }
          }
        }
        list.appendChild(item);

        p.appendChild(list);

        container.appendChild(p);
        break;
      }
      case "horizontalRule": {
        container.appendChild(document.createElement("hr"));
        let markdown_rule = "---\n";
        markdown.content += markdown_rule;
        rawMarkdown += markdown_rule;
        break;
      }
      case "callout": {
        setId(block);
        let range = markdownView.editor.getRange(
          {
            line: block.lineStart,
            ch: 0
          },
          {
            line: block.lineEnd + 1,
            ch: 0
          }
        );

        markdownView.editor.setValue(range);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        const cmCallout = currentDocument.querySelector(
          ".cm-callout"
        ) as HTMLElement;

        const filePath = `/${appSettings.assetDirectory}/${block.callout}-widget-${block.lineStart}-${block.lineEnd}.png`;

        if (cmCallout) {
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmCallout,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;
            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }
      case "quote": {
        setId(block);
        const blockquote = document.createElement("blockquote");
        blockquote.className = `graf--${block.quoteType}`;

        rawMarkdown +=
          `${block.quoteType === "blockquote" ? ">" : ">>"}` +
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            blockquote,
            footnoteMap
          ) +
          "\n";

        markdown.content += blockquote.outerHTML + "\n";

        container.appendChild(blockquote);
        break;
      }
      case "code": {
        setId(block);
        const codeBlock = document.createElement("pre");
        const code = document.createElement("code");
        codeBlock.appendChild(code);
        markdown.content += "\t";
        rawMarkdown += "\t";

        rawMarkdown +=
          parseBlock(
            tokenizeBlock(block.content, true),
            app,
            appSettings,
            code,
            footnoteMap,
            markdown
          ) + "\n";

        container.appendChild(codeBlock);
        break;
      }
      case "codeBlock": {
        setId(block);
        let language = convertLanguageToValid(block.language);
        let isValidLang = isValidLanguage(language);
        const shouldConvertToPng = appSettings.convertCodeToPng;
        const blockRequiresPng = block.toPng;

        if (
          (!isValidLang ||
            (!shouldConvertToPng && blockRequiresPng) ||
            (shouldConvertToPng && !blockRequiresPng)) &&
          language.length > 0
        ) {
          markdownView.editor.setValue(
            `\`\`\`${language}\n${block.content}\`\`\``
          );
          markdownView.editor.refresh();
          await new Promise((resolve) =>
            setTimeout(resolve, appSettings.loadTime)
          );

          let cmEmbed = currentDocument.querySelector(
            ".cm-embed-block"
          ) as HTMLElement;

          const filePath = `/${appSettings.assetDirectory}/${block.language}-widget-${block.lineStart}-${block.lineEnd}.png`;

          try {
            if (!cmEmbed) {
              cmEmbed = createDiv();

              while (currentDocument.firstChild) {
                if (
                  currentDocument.firstChild instanceof HTMLElement &&
                  currentDocument.firstChild.className.contains(
                    "HyperMD-codeblock"
                  )
                ) {
                  cmEmbed.appendChild(currentDocument.firstChild);
                } else {
                  currentDocument.removeChild(currentDocument.firstChild);
                }
              }

              currentDocument.appendChild(cmEmbed);
            }

            const { width, height } = await saveHtmlAsPng(
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                doc.body.style.height = "fit-content";

                toggleClass(
                  doc.body,
                  "theme-dark",
                  (block.useLightTheme && !appSettings.useDarkTheme) ||
                    (!block.useLightTheme && appSettings.useDarkTheme)
                );

                toggleClass(
                  doc.body,
                  "theme-light",
                  (!block.useLightTheme && !appSettings.useDarkTheme) ||
                    (block.useLightTheme && appSettings.useDarkTheme)
                );

                if (element instanceof HTMLElement) {
                  element.style.width = "fit-content";
                  element.style.height = "fit-content";
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  element.style.color = "var(--text-normal)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });

                  const hmds = element.querySelectorAll(".cm-hmd-codeblock");
                  const flair = element.querySelector(".code-block-flair");
                  for (const hmd of hmds) {
                    if (hmd instanceof HTMLElement) {
                      hmd.style.fontFamily = appSettings.codeFontFamily;
                      hmd.style.fontWeight = "600";
                    }
                  }

                  if (flair instanceof HTMLElement) {
                    flair.style.display = "none";
                  }
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");
            const image = imageBlock.querySelector("img") as HTMLImageElement;

            let markdown_caption: string;
            if (
              block.caption ||
              (appSettings.useCodeBlockLanguageForCaption &&
                language.length > 0)
            ) {
              const caption = imageBlock.querySelector(
                "figcaption"
              ) as HTMLElement;

              markdown_caption = parseBlock(
                tokenizeBlock(block.caption || language),
                app,
                appSettings,
                caption,
                footnoteMap
              );
            }

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath} ${
              markdown_caption ? `"${markdown_caption}"` : ""
            })\n`;
            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        } else {
          const codeBlock = document.createElement("pre");
          const code = document.createElement("span");
          codeBlock.setAttribute(
            "data-code-block-mode",
            isValidLang ? "2" : language.length > 0 ? "1" : "0"
          );
          if (language.length > 0)
            codeBlock.setAttribute("data-code-block-lang", language);

          if (language.length > 0) {
            code.className = block.language;
            code.textContent = block.content;
            codeBlock.appendChild(code);
          } else {
            codeBlock.replaceWith(createHiddenSpan());
            const tokens = tokenizeBlock(block.content);

            parseBlock(tokens, app, appSettings, codeBlock, footnoteMap);
          }

          let markdown_codeblock = `\`\`\`${language}\n${block.content}\`\`\`\n`;
          markdown.content += markdown_codeblock;
          rawMarkdown += markdown_codeblock;
          container.appendChild(codeBlock);
        }
        break;
      }
      case "footnote": {
        let display: string;
        if (footnoteMap[block.id]) {
          display = footnoteMap[block.id];
        } else {
          display = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[block.id] = display;
        }

        footnotes[display] = block;
        break;
      }
      case "math": {
        setId(block);
        markdownView.editor.setValue(`$$\n${block.content}\n$$`);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        let cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        const filePath = `/${appSettings.assetDirectory}/math-widget-${block.lineStart}-${block.lineEnd}.png`;

        if (cmEmbed) {
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                if (!doc.body || !doc.body.toggleClass || !element) {
                  new Notice(`ERROR: uploading ${filePath}`);
                }
                doc.body.style.width = "fit-content";
                doc.body.style.height = "fit-content";
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);

                if (element instanceof HTMLElement) {
                  element.style.width = "fit-content";
                  element.style.height = "fit-content";
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    color: "var(--text-normal)"
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");
            const image = imageBlock.querySelector("img") as HTMLImageElement;

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;

            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }
      case "table": {
        setId(block);
        const markdown_table = createMarkdownTable(block.body);
        markdownView.editor.setValue(markdown_table);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        const cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        if (cmEmbed) {
          const filePath = `/${appSettings.assetDirectory}/table-widget-${block.lineStart}-${block.lineEnd}.png`;
          const table = cmEmbed.querySelector("table") as HTMLTableElement;
          table.style.backgroundColor = "var(--background-primary)";
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              (doc, element) => {
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;
            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            container.appendChild(imageBlock);
            if (appSettings.convertTableToPng) {
              markdown.content += image.outerHTML + "\n";
              rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;
            } else {
              markdown.content += markdown_table + "\n";
              rawMarkdown += markdown_table + "\n";
            }
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }

      case "break": {
        for (let i = 1; i <= block.count; i++) {
          if (i % 2 === 0) {
            const p = createHiddenParagraph();
            p.className = "obsidian-break";
            container.appendChild(p);
          }
          markdown.content += "\n\n";
          rawMarkdown += "\n\n";
        }
        break;
      }
    }
    if (markdownView.editor.getValue() !== currentValue) {
      markdownView.editor.setValue(currentValue);
      markdownView.editor.refresh();
    }
  }

  if (Object.keys(footnotes).length > 0) {
    container.appendChild(document.createElement("hr"));
    markdown.content += "---\n";
    rawMarkdown += "---\n";
    for (const key in footnotes) {
      const block = footnotes[key];
      const footnote = document.createElement("p");
      const footnoteId = document.createElement("strong");
      const footnoteContent = document.createElement("code");
      footnote.appendChild(footnoteId);
      footnote.appendChild(footnoteContent);

      footnote.id = block.id;
      footnote.setAttribute("name", block.id);

      footnoteId.textContent = `${key}. `;

      markdown.content += `[^${key}]:`;
      rawMarkdown += `[^${key}]:`;

      rawMarkdown += parseBlock(
        tokenizeBlock(block.content),
        app,
        appSettings,
        footnoteContent,
        footnoteMap,
        markdown
      );

      footnote.id = block.id;
      footnote.setAttribute("name", block.id);

      container.appendChild(footnote);
    }
  }

  return {
    html: container,
    markdown: markdown,
    rawMarkdown: (createTOC ? tocMarkdown + "\n" : "") + rawMarkdown
  };
};

export class Parser {
  private app: App;
  private appSettings: Settings;
  private config: PublishConfig;
  private markdownView: MarkdownView;
  private currentDocument: HTMLElement;
  private currentValue: string;
  private footnoteMap: Record<string, string>;
  private footnotes: Record<string, Footnote & BlockBase>;
  private markdown: Markdown;
  private rawMarkdown: string;
  private createTOC: boolean;
  private blocks: Block[];

  constructor(
    app: App,
    blocks: Block[],
    config: PublishConfig,
    appSettings: Settings,
    markdownView: MarkdownView,
    currentDocument: HTMLElement,
    currentValue: string,
    footnoteMap: Record<string, string>,
    footnotes: Record<string, Footnote & BlockBase>,
    markdown: Markdown,
    rawMarkdown: string,
    createTOC: boolean
  ) {
    this.app = app;
    this.blocks = blocks;
    this.config = config;
    this.appSettings = appSettings;
    this.markdownView = markdownView;
    this.currentDocument = currentDocument;
    this.currentValue = currentValue;
    this.footnoteMap = footnoteMap;
    this.footnotes = footnotes;
    this.markdown = markdown;
    this.rawMarkdown = rawMarkdown;
    this.createTOC = createTOC;
  }

  private async parseList(
    block: List & BlockBase,
    scope: number = 0,
    container: HTMLElement = createEl("p")
  ) {
    const item = createEl("li");

    for (const child of block.children) {
      let childScope = " ".repeat(scope * 4);

      if (child.type === "list") {
        const childList = createEl(child.ordered ? "ol" : "ul");
        const { rawMarkdown: newRawMarkdown, markdown: newMarkdown } =
          await this.parseList(child, scope + 1, childList);

        this.markdown.content = newMarkdown.content;
        this.rawMarkdown = newRawMarkdown;

        item.appendChild(childList);
      } else {
        let lines = child.content.split("\n");
        let preface = `${block.ordered ? block.number + ". " : "- "}`;

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          const newRawMarkdown = parseBlock(
            tokenizeBlock(line),
            this.app,
            this.appSettings,
            item,
            this.footnoteMap
          );

          let content =
            childScope + (i === 0 ? preface : "") + newRawMarkdown + "\n";
          this.markdown.content += content;
          this.rawMarkdown += content;

          if (i !== lines.length - 1) {
            item.appendChild(createEl("br"));
          }
        }
      }
    }
    container.appendChild(item);

    return { markdown: this.markdown, rawMarkdown: this.rawMarkdown };
  }

  public async parse(): Promise<HtmlMarkdownContent> {
    let container = createEl("div");
    let tocMarkdown = "# Table of Contents\n";

    for (let index = 0; index < this.blocks.length; index++) {
      const block = this.blocks[index];

      switch (block.type) {
        case "list":
          this.parseList(block);
          break;
      }
    }

    return {
      html: container,
      markdown: markdown,
      rawMarkdown: (createTOC ? tocMarkdown + "\n" : "") + rawMarkdown
    };
  }
}

const parseBlock = (
  tokens: Token[],
  app: App,
  appSettings: Settings,
  container: HTMLElement,
  footnoteMap: Record<string, string>,
  markdown: Markdown = { content: "" }
): string => {
  let elementQueue: HTMLElement[] = [];
  let rawMarkdown = "";

  const popElement = (tagName: string): boolean => {
    if (
      elementQueue.length > 0 &&
      elementQueue[elementQueue.length - 1].tagName === tagName
    ) {
      elementQueue.pop();
      return true;
    }
    return false;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendText(token.text);
        } else {
          container.appendText(token.text);
        }
        markdown.content += token.text;
        rawMarkdown += token.text;
        break;
      }
      case "strong":
      case "em":
      case "del":
      case "mark": {
        const element = document.createElement(token.type);
        let found = popElement(token.type.toUpperCase());
        markdown.content += found ? `</${token.type}>` : `<${token.type}>`;
        rawMarkdown +=
          token.type === "del"
            ? "~~"
            : token.type === "mark"
              ? "=="
              : token.type === "em"
                ? "*"
                : "**";

        if (found) break;
        if (elementQueue.length > 0) {
          if (elementQueue[elementQueue.length - 1].tagName === token.type) {
            elementQueue.pop();
            break;
          } else {
            elementQueue[elementQueue.length - 1].appendChild(element);
          }
        } else {
          container.appendChild(element);
        }
        elementQueue.push(element);
        break;
      }
      case "link":
        const link = createLinkElement(token.url, token.text);

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(link);
        } else {
          container.appendChild(link);
        }
        let markdown_link = `[${token.text}](${token.url})`;
        markdown.content += markdown_link;
        rawMarkdown += markdown_link;
        break;
      case "image": {
        const imageBlock = createImage(token.url, token.alt);
        const image = imageBlock.querySelector("img") as HTMLImageElement;
        let src = token.url;
        if (token.dimensions) {
          const { width, height } = token.dimensions;
          image.setAttribute("data-width", width.toString());
          image.style.maxWidth = `${width}px`;
          src += width;
          if (height) {
            image.setAttribute("data-height", height.toString());
            image.style.maxHeight = `${height}px`;
            src += height;
          }
        }

        let markdown_caption = "";
        if (token.caption) {
          const caption = imageBlock.querySelector("figcaption") as HTMLElement;

          markdown_caption += parseBlock(
            tokenizeBlock(token.caption),
            app,
            appSettings,
            caption,
            footnoteMap
          );
        }

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(imageBlock);
        } else {
          container.appendChild(imageBlock);
        }

        if (markdown.content.length == 0) {
          const image = {
            url: src,
            caption: token.caption,
            alt: token.alt
          };

          markdown.mainImage = image;
        } else {
          let cloned = image.cloneNode(true) as HTMLImageElement;
          cloned.setAttribute("_src", src);
          markdown.content += cloned.outerHTML;
        }

        rawMarkdown += `![${token.alt}](${src}${
          token.caption ? ` " ${markdown_caption}"` : ""
        })`;

        break;
      }
      case "code": {
        const code = document.createElement("code");
        code.setAttribute("data-testid", "editorParagraphText");
        markdown.content += "`";

        rawMarkdown +=
          "`" +
          parseBlock(
            tokenizeBlock(token.content, true),
            app,
            appSettings,
            code,
            footnoteMap,
            markdown
          ) +
          "`";

        markdown.content += "`";

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(code);
        } else {
          container.appendChild(code);
        }
        break;
      }
      case "footnoteUrl": {
        const link = document.createElement("a");
        let url = `#${
          token.id.charAt(0) === "^" ? token.id.slice(1) : token.id
        }`;

        let id: string;
        if (footnoteMap[token.id]) {
          id = footnoteMap[token.id];
        } else {
          id = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[token.id] = id;
        }

        let display: string = "";
        for (let i = 0; i < id.length; i++) {
          display += superscriptMap[id[i]];
        }

        link.textContent = display;
        link.href = url;

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(link);
        } else {
          container.appendChild(link);
        }

        let markdown_footnote = `[^${id}]`;
        markdown.content += markdown_footnote;
        rawMarkdown += markdown_footnote;

        break;
      }
    }
  }

  return rawMarkdown;
};
