import { checkChar } from "src/utils";

export type BlockBase = {
  lineStart: number;
  lineEnd: number;
  content: string;
  id?: string;
  scope: number;
};

export type Math = {
  type: "math";
  isInline: boolean;
};

export type List = {
  type: "list";
  number?: number;
  ordered: boolean;
  children: Block[];
};

export type Heading = {
  type: "heading";
  level: number;
};

export type HorizontalRule = {
  type: "horizontalRule";
};

export type Break = {
  type: "break";
  count: number;
};

export type CodeBlock = {
  type: "codeBlock";
  language: string;
  caption: string;
  toPng: boolean;
  useLightTheme: boolean;
};

export type Code = {
  type: "code";
};

export type Table = {
  type: "table";
  body: string[][];
};

export type Content = {
  type: "content";
};

export type Callout = {
  type: "callout";
  callout: string;
};

export type Quote = {
  type: "quote";
  quoteType: "blockquote" | "pullquote";
};

export type Footnote = {
  type: "footnote";
  id: string;
};

export type Block = (
  | Code
  | Math
  | Table
  | Content
  | Callout
  | Quote
  | Break
  | HorizontalRule
  | Heading
  | CodeBlock
  | Footnote
  | List
) &
  BlockBase;

export class Tokenizer {
  private readonly lines: string[];
  private prevIndex: number;
  private index: number;
  private readonly blocks: Block[] = [];
  private blockRoot: Block | null = null;
  private blockQueue: (List & BlockBase)[] = [];
  private buffer: string = "";

  constructor(markdown: string) {
    this.lines = markdown.split("\n");
    this.prevIndex = 0;
    this.index = 0;
  }

  private getId(content: string): {
    content: string;
    id: string | null;
  } {
    let validId = false;
    let idIndex = -1;
    let id: string | null = null;
    for (let i = content.length - 1; i >= 0; i--) {
      if (
        checkChar({ isLetter: true, isNumber: true, isUnique: "-" }, content[i])
      ) {
        validId = true;
        continue;
      } else if (content[i] === "^") {
        idIndex = i;
        break;
      }
      break;
    }

    if (validId && idIndex !== -1) {
      id = content.slice(idIndex);
      content = content.slice(0, idIndex);
    }

    return {
      content,
      id
    };
  }

  private getScope(line: string): number {
    let spaces = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === " " || line[i] === "\t") {
        spaces += line[i] === " " ? 1 : line[i] === "\t" ? 4 : 0;
      } else {
        break;
      }
    }

    return Math.floor(spaces / 4);
  }

  private tokenizeCodeBlock(): void {
    let line = this.lines[this.index];
    let count = 0;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === "`") {
        count++;
      } else {
        break;
      }
    }

    let language = line.slice(count).trim();
    const match = language.match(/[^a-zA-Z0-9#+-]/);
    let caption;
    let toPng = false;
    let useLightTheme = false;

    if (match) {
      const index = match.index;
      const char = language.charAt(index);
      const nextChar = language.charAt(index + 1);
      if (char === "!" || char === "*") {
        toPng = char === "!" || nextChar === "!";
        useLightTheme = char === "*" || nextChar === "*";
      }

      let count = Number(toPng) + Number(useLightTheme);

      caption = language.slice(index + count);

      language = language.slice(0, index);
    }

    let content = "";
    let hasEnd = false;
    this.prevIndex = this.index;

    for (let i = this.index + 1; i < this.lines.length; i++) {
      let isLineEnd = false;
      let line = this.lines[i];
      for (let j = 0; j < line.length; j++) {
        if (line[j] == "`") {
          let nextCount = 1;
          for (let k = j + 1; k < line.length; k++) {
            if (line[k] == "`") {
              nextCount++;
              j = k;
            } else {
              break;
            }
          }

          if (nextCount === count) {
            isLineEnd = true;
            for (let k = j + 1; k < line.length; k++) {
              if (line[k] !== " " && line[k] !== "\t") {
                isLineEnd = false;
                break;
              }
            }

            if (isLineEnd) {
              break;
            }
          }
        }
      }

      if (isLineEnd) {
        this.index = i;
        hasEnd = true;
        break;
      }

      content += this.lines[i] + "\n";
    }

    if (!hasEnd) {
      this.index = this.lines.length;
    }

    if (count === 3) {
      this.blocks.push({
        type: "codeBlock",
        caption,
        content,
        language,
        lineEnd: this.index,
        lineStart: this.prevIndex,
        toPng,
        scope: 0,
        useLightTheme
      });
    } else {
      this.blocks.push({
        type: "code",
        content,
        scope: 0,
        lineEnd: this.index,
        lineStart: this.prevIndex
      });
    }

    this.index++;
  }

  private tokenizeTable(): boolean {
    let rows = 0;
    let line = this.lines[this.index];

    if (!line.contains("|")) {
      return false;
    }

    let headers = line.split("|");
    let isIndirectTable = headers[0].trim().length !== 0;

    let isValidTable = true;

    let headerDivider = this.lines[this.index + 1].split("|");

    if (
      headerDivider.length == 0 ||
      !this.lines[this.index + 1].contains("|")
    ) {
      this.buffer += (this.buffer.length > 0 ? "\n" : "") + line;
      this.index++;
    }

    for (let i = 0; i < headerDivider.length; i++) {
      let trimmed = headerDivider[i].trim();
      if (!isIndirectTable && (i === 0 || i === headerDivider.length - 1)) {
        if (trimmed.length !== 0) {
          isValidTable = false;
          break;
        }
      } else {
        if ("-".repeat(trimmed.length) !== trimmed) {
          isValidTable = false;
          break;
        }

        rows++;
      }
    }

    if (
      ((!isIndirectTable && headers[headers.length - 1].trim().length === 0) ||
        isIndirectTable) &&
      isValidTable
    ) {
      let filteredHeaders = (
        isIndirectTable ? headers : headers.slice(1, -1)
      ).map((header) => header.trim());

      if (filteredHeaders.length < rows) {
        filteredHeaders.push(...Array(rows - filteredHeaders.length).fill(""));
      }

      let table: string[][] = [filteredHeaders];

      for (let i = this.index + 2; i < this.lines.length; i++) {
        let isValidTable = true;

        let rows = this.lines[i].split("|");

        if (rows.length == 0 || !this.lines[i].contains("|")) {
          break;
        }

        for (let j = 0; j < rows.length; j++) {
          let trimmed = rows[j].trim();
          if (!isIndirectTable && (j === 0 || j === rows.length - 1)) {
            if (trimmed.length !== 0) {
              isValidTable = false;
              break;
            }
          }
        }

        if (isValidTable) {
          table.push(
            (isIndirectTable ? rows : rows.slice(1, -1))
              .map((row) => row.trim())
              .slice(0, filteredHeaders.length)
          );
        } else {
          break;
        }
      }

      this.blocks.push({
        type: "table",
        lineStart: this.index,
        lineEnd: this.index,
        content: "",
        scope: 0,
        body: table
      });
      this.index += table.length + 1;

      return true;
    }

    return false;
  }

  private tokenizeHeading(): boolean {
    let line = this.lines[this.index];
    let level = 1;
    for (let j = 1; j < line.length; j++) {
      if (line[j] === "#") {
        level++;
      } else {
        break;
      }
    }

    if (level <= 6 && line[level] === " ") {
      let content = line.slice(level + 1);
      this.blocks.push({
        type: "heading",
        level,
        lineStart: this.index,
        lineEnd: this.index,
        scope: 0,
        content
      });

      this.index++;

      return true;
    } else {
      return false;
    }
  }

  private tokenizeHorizontalRule(): boolean {
    let line = this.lines[this.index].trim();
    let char = line[0];
    let nextChar = line[1];

    if (nextChar === " ") {
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        if (
          (count % 2 === 0 && line[i] === char) ||
          (count % 2 !== 0 && line[i] === " " && count < 5)
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count === 5) {
        let hasCharacters = false;

        for (let i = count - 1; i < line.length; i++) {
          if (line[i] !== " " && line[i] !== "\t" && line[i] !== char) {
            hasCharacters = true;
            break;
          }
        }

        if (!hasCharacters) {
          return true;
        }
      }
    } else {
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === char) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 3 && count <= 4) {
        let hasCharacters = false;

        for (let i = count; i < line.length; i++) {
          if (line[i] !== " " && line[i] !== "\t") {
            hasCharacters = true;
            break;
          }
        }

        if (!hasCharacters) {
          return true;
        }
      }
    }

    return false;
  }

  private collapseBlockQueue(scope: number) {
    if (scope == -1) {
      this.pushBlockRoot();
    }

    let index = this.blockQueue.length - 1;

    while (index >= 0) {
      let block = this.blockQueue[index];
      if (block.type === "list" && block.scope <= scope) {
        break;
      }

      index--;
    }

    if (index >= 0) this.blockQueue = this.blockQueue.slice(0, index + 1);
    else this.blockQueue = [];
  }

  private tokenizeList(
    scope: number,
    content: string,
    number?: number
  ): boolean {
    if (this.blockRoot && this.blockRoot.type !== "list" && scope > 0)
      return false;

    let list: List & BlockBase = {
      type: "list",
      scope,
      lineStart: this.index,
      lineEnd: this.index,
      ordered: number !== undefined,
      number,
      content: "",
      children: []
    };

    if (scope === 0) {
      this.pushBlockRoot();

      list.children.push({
        type: "content",
        lineStart: this.index,
        lineEnd: this.index,
        scope,
        content: content
      });
      this.blockQueue.push(list);
      this.index++;
      this.blockRoot = list;

      return true;
    } else {
      this.collapseBlockQueue(scope - 1);

      let parent = this.blockQueue[this.blockQueue.length - 1];

      if (parent && parent.type === "list" && parent.scope === scope - 1) {
        parent.children.push(list);
        this.blockQueue.push(list);

        list.children.push({
          type: "content",
          lineStart: this.index,
          lineEnd: this.index,
          scope,
          content: content
        });

        this.index++;

        return true;
      }
    }

    return false;
  }

  private tokenizeCallout(scope: number, line: string): boolean {
    let callout: string = "";

    let hasEnd = false;
    let calloutEnd = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "]") {
        hasEnd = true;
        calloutEnd = i;
        break;
      }
    }

    if (hasEnd) {
      callout = line.slice(0, calloutEnd);
    } else {
      return false;
    }

    this.prevIndex = this.index;
    for (let i = this.index + 1; i < this.lines.length; i++) {
      let nextLine = this.lines[i];
      let scope = this.getScope(nextLine);
      nextLine = nextLine.trim();
      if (scope === 0) {
        if (nextLine.length == 0) {
          break;
        }
      } else {
        if (nextLine[0] !== ">") {
          break;
        }
      }
      this.index = i;
    }

    let block: Callout & BlockBase = {
      type: "callout",
      lineStart: this.prevIndex,
      lineEnd: this.index,
      scope,
      callout,
      content: callout
    };

    if (this.blockRoot) {
      switch (this.blockRoot.type) {
        case "content":
        case "quote":
        case "code":
        case "footnote":
          let { content, id } = this.getId(this.blockRoot.content);
          this.blockRoot.content = content;
          this.blockRoot.id = id;
          this.pushBlockRoot();
          break;
        case "list":
          {
            this.collapseBlockQueue(scope);
            let parent = this.blockQueue[this.blockQueue.length - 1];

            if (parent) {
              parent.children.push(block);
              this.index++;
              return true;
            } else {
              this.pushBlockRoot();
            }
          }
          break;
        default:
          this.pushBlockRoot();
      }
    }

    this.blocks.push(block);
    this.index++;

    return true;
  }

  private tokenizeQuote(scope: number): void {
    let line = this.lines[this.index].trim();

    let count = 0;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === ">") {
        count++;
      } else {
        break;
      }
    }

    let quoteType: "blockquote" | "pullquote" =
      count === 1 ? "blockquote" : "pullquote";

    line = line.slice(count).trim();

    let isCalloutable = true;
    if (this.blockRoot) {
      switch (this.blockRoot.type) {
        case "quote":
          isCalloutable = false;
          break;
        case "list": {
          let parent = this.blockQueue[this.blockQueue.length - 1];

          if (parent) {
            if (parent.children[parent.children.length - 1].type === "quote") {
              isCalloutable = false;
              break;
            }
          }
        }
      }
    }
    if (isCalloutable && line[0] === "[" && line[1] === "!" && scope === 0) {
      if (this.tokenizeCallout(scope, line.slice(2))) {
        return;
      }
    }

    let block: Block = {
      type: "quote",
      quoteType,
      lineStart: this.prevIndex,
      scope,
      lineEnd: this.index,
      content: line + "\n"
    };

    if (this.blockRoot) {
      switch (this.blockRoot.type) {
        case "content":
        case "code":
        case "footnote":
          let { content, id } = this.getId(this.blockRoot.content);
          this.blockRoot.content = content;
          this.blockRoot.id = id;
          this.pushBlockRoot();
          break;
        case "quote":
          if (this.blockRoot.quoteType === quoteType) {
            this.blockRoot.content += line + "\n";
            this.index++;
            return;
          } else {
            this.pushBlockRoot();
          }
          break;
        case "list":
          {
            this.collapseBlockQueue(scope);
            let parent = this.blockQueue[this.blockQueue.length - 1];

            if (parent) {
              let prevContent = parent.children[parent.children.length - 1];
              let content = `${">".repeat(count)}${line}`;
              switch (prevContent.type) {
                case "quote":
                  if (prevContent.scope < scope) {
                    parent.children.push({
                      type: "code",
                      lineStart: this.index,
                      lineEnd: this.index,
                      scope,
                      content
                    });
                  } else {
                    if (prevContent.quoteType === quoteType) {
                      prevContent.content += line + "\n";
                    } else {
                      parent.children.push(block);
                    }
                  }
                  break;
                case "content":
                  if (prevContent.scope <= scope) {
                    parent.children.push(block);
                  } else {
                    prevContent.content += content + "\n";
                  }
                  break;
                case "code":
                  if (scope > 0) {
                    prevContent.content += content + "\n";
                  } else {
                    parent.children.push(block);
                  }
                  break;
                default:
                  if (parent.scope + 1 >= scope) {
                    parent.children.push(block);
                  } else {
                    parent.children.push({
                      type: "content",
                      lineStart: this.index,
                      lineEnd: this.index,
                      scope,
                      content: content + "\n"
                    });
                  }
                  break;
              }

              this.index++;
              return;
            }
          }
          break;
        default:
          this.pushBlockRoot();
          break;
      }
    }

    this.blocks.push(block);
    this.index++;
  }

  private pushBlockRoot(): void {
    if (this.blockRoot) {
      this.blocks.push(this.blockRoot);
      this.blockRoot = null;
      this.blockQueue = [];
    }
  }

  private next(): void {
    let line = this.lines[this.index];
    let scope: number = this.getScope(line);
    line = line.trim();
    let char = line[0];
    let nextChar = line[1];

    if (line.length === 0) {
      if (this.blockRoot) {
        switch (this.blockRoot.type) {
          case "content":
          case "footnote":
          case "quote":
          case "code":
            let { content, id } = this.getId(this.blockRoot.content);
            this.blockRoot.content = content;
            this.blockRoot.id = id;
            this.pushBlockRoot();
            break;
          default:
            this.pushBlockRoot();
        }
      }

      this.index++;
      return;
    }

    if (!this.blockRoot) {
      if (line.startsWith("```")) {
        this.tokenizeCodeBlock();
        return;
      }

      if (this.tokenizeTable()) return;

      if (char === "#" && this.tokenizeHeading()) return;

      if (scope > 0) {
        this.blockRoot = {
          type: "code",
          lineStart: this.index,
          lineEnd: this.index,
          scope,
          content: line + "\n"
        };

        this.index++;

        return;
      }
    } else {
      if (this.blockRoot.type === "code") {
        if (scope > 0) {
          this.blockRoot.content += line + "\n";
          this.index++;
          return;
        } else {
          this.pushBlockRoot();
        }
      }
    }

    switch (char) {
      case "+":
        if (nextChar === " ") {
          if (this.tokenizeList(scope, line.slice(2))) {
            return;
          }
        }
        break;
      case "*":
      case "-":
        {
          if (scope === 0) {
            if (scope === 0 && this.tokenizeHorizontalRule()) {
              if (this.blockRoot) this.pushBlockRoot();
              this.blocks.push({
                type: "horizontalRule",
                lineStart: this.index,
                lineEnd: this.index,
                scope,
                content: ""
              });
              this.index++;
              return;
            }
          }
          if (nextChar === " " && this.tokenizeList(scope, line.slice(2))) {
            return;
          }
        }
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        let count = 1;

        for (let i = 1; i < line.length; i++) {
          if (line[i] >= "0" && line[i] <= "9") {
            count++;
          } else {
            break;
          }
        }

        if (line[count] === "." && line[count + 1] === " ") {
          let number = parseInt(line.slice(0, count));

          if (this.tokenizeList(scope, line.slice(count + 2), number)) {
            return;
          }

          break;
        }
      case "#":
        {
          if (scope === 0 && this.tokenizeHeading()) {
            return;
          }
        }
        break;
      case ">": {
        this.tokenizeQuote(scope);
        return;
      }
    }

    let content: Content & BlockBase = {
      type: "content",
      lineStart: this.index,
      scope,
      lineEnd: this.index,
      content: line + "\n"
    };

    if (this.blockRoot) {
      switch (this.blockRoot.type) {
        case "content":
          this.blockRoot.content += line + "\n";
          break;
        case "quote":
        case "footnote":
          if (scope > 0) {
            this.pushBlockRoot();
            this.blockRoot = {
              type: "code",
              lineStart: this.index,
              lineEnd: this.index,
              scope,
              content: line + "\n"
            };
          } else {
            this.blockRoot.content += line + "\n";
          }
          break;
        case "list":
          {
            this.collapseBlockQueue(scope);
            let parent = this.blockQueue[this.blockQueue.length - 1];

            if (parent && parent.type === "list") {
              let prevContent = parent.children[parent.children.length - 1];

              switch (prevContent.type) {
                case "code":
                  if (scope > 0) {
                    prevContent.content += line + "\n";
                  } else {
                    parent.children.push(content);
                  }
                  break;
                case "content":
                  {
                    let { content, id } = this.getId(prevContent.content);

                    if (id) {
                      parent.children.push({
                        type: "content",
                        lineStart: this.index,
                        lineEnd: this.index,
                        scope,
                        content: content + "\n",
                        id
                      });
                    } else {
                      prevContent.content += line + "\n";
                    }
                  }
                  break;
                case "quote":
                  if (scope > 0) {
                    parent.children.push({
                      type: "code",
                      lineStart: this.index,
                      lineEnd: this.index,
                      scope,
                      content: line + "\n"
                    });
                  } else {
                    prevContent.content += line + "\n";
                  }
                  break;
                default:
                  parent.children.push(content);
                  break;
              }
            }
          }
          break;
        default:
          this.pushBlockRoot();
          this.blockRoot = content;
      }
    } else {
      this.blockRoot = content;
    }

    this.index++;
  }

  tokenize(): Block[] {
    while (this.index < this.lines.length) {
      this.next();
    }

    if (this.blockRoot) {
      let { content, id } = this.getId(this.blockRoot.content);
      this.blockRoot.content = content;
      this.blockRoot.id = id;
      this.pushBlockRoot();
    }

    return this.blocks;
  }
}
