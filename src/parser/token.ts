export type ImageToken = {
  type: "image";
  url: string;
  alt: string;
  caption: string;
  dimensions?: {
    width: number;
    height?: number;
  };
};

export type LinkToken = {
  type: "link";
  url: string;
  text: string;
};

export type MarkToken = {
  type: "mark";
};

export type MathToken = {
  type: "math";
  content: string;
};

export type DelToken = {
  type: "del";
};

export type BoldToken = {
  type: "strong";
};

export type ItalicToken = {
  type: "em";
};

export type TextToken = {
  type: "text";
  text: string;
};

export type CodeToken = {
  type: "code";
  content: string;
};

export type FootnoteUrlToken = {
  type: "footnoteUrl";
  id: string;
};

export type Token =
  | MarkToken
  | MathToken
  | DelToken
  | ImageToken
  | LinkToken
  | BoldToken
  | ItalicToken
  | TextToken
  | FootnoteUrlToken
  | CodeToken;
