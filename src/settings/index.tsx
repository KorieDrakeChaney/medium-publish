import { PluginSettingTab, prepareFuzzySearch, SearchResult } from "obsidian";
import type { DevtoMeData } from "../api/response";
import { createReactModal } from "../ui/modal";
import styles from "./setting.module.css";
import MdBlogger from "../main";
import { createRoot, Root } from "react-dom/client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { PluginProvider, usePluginContext } from "../ui/context";
import { FaXmark, FaCheck } from "react-icons/fa6";
import { SettingItem, Toggle } from "src/ui/components";
import Dropdown from "src/ui/components/dropdown/dropdown";
import SettingNumberInput from "src/ui/components/number-input/number-input";

type CodeFontFamily =
  | "monospace"
  | "Courier New"
  | "Consolas"
  | "Lucida Console"
  | "Source Code Pro"
  | "Fira Code"
  | "Roboto Mono"
  | "Inconsolata";
type GeneralFontFamily =
  | "sans-serif"
  | "Arial"
  | "Arial Black"
  | "Comic Sans MS"
  | "Courier New"
  | "Georgia"
  | "Impact"
  | "Lucida Console"
  | "Lucida Sans Unicode"
  | "Palatino Linotype"
  | "Tahoma"
  | "Times New Roman"
  | "Trebuchet MS"
  | "Verdana";

export type Settings = {
  devtoToken: string;
  imgurClientId: string;
  assetDirectory: string;
  convertCodeToPng: boolean;
  createTOC: boolean;
  useNumberedTOC: boolean;
  useDarkTheme: boolean;
  loadTime: number;
  convertTableToPng: boolean;
  useCodeBlockLanguageForCaption: boolean;
  useFilenameAsTitle: boolean;
  ignoreBeginningNewlines: boolean;
  customWidth: boolean;
  targetWidth: number;
  imageScale: number;
  smoothing: boolean;
  generalFontFamily: GeneralFontFamily;
  codeFontFamily: CodeFontFamily;
  devtoProfile?: DevtoMeData;
  validDevtoKey?: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  devtoToken: "",
  imgurClientId: "",
  assetDirectory: "publish-assets",
  loadTime: 100,
  convertCodeToPng: false,
  createTOC: true,
  useNumberedTOC: true,
  useCodeBlockLanguageForCaption: false,
  useFilenameAsTitle: true,
  useDarkTheme: false,
  ignoreBeginningNewlines: true,
  convertTableToPng: false,
  customWidth: false,
  targetWidth: 2560,
  imageScale: 4,
  codeFontFamily: "Lucida Console",
  generalFontFamily: "sans-serif",
  smoothing: true
};

export class PublishSettingTab extends PluginSettingTab {
  readonly plugin: MdBlogger;
  private root: Root;

  constructor(plugin: MdBlogger) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.root = createRoot(this.containerEl);
  }

  display() {
    this.root.render(
      <PluginProvider plugin={this.plugin}>
        <Settings />
      </PluginProvider>
    );
  }
}

interface SettingGroup {
  title: string;
  children: React.ReactNode;
}

const SettingGroup = ({ title, children }: SettingGroup) => {
  return (
    <div className={styles["setting-group-container"]}>
      <h3 className={styles["setting-group"]}>{title}</h3>
      <div className={styles["setting-group-children"]}>{children}</div>
    </div>
  );
};

interface SettingFileInputProps {
  value: string;
  placeholder: string;
  onSelect: (value: FileResult) => void;
}

const SettingFileInput = ({
  value: initialValue,
  placeholder,
  onSelect
}: SettingFileInputProps) => {
  const { plugin } = usePluginContext();
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const [results, setResults] = useState<FileResult[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [focused, setFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFolders(
      plugin.app.vault.getAllFolders(true).map((folder) => {
        return folder.name.length > 0 ? folder.name : "/";
      })
    );
  }, []);

  const search = async (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);

    const search = prepareFuzzySearch(value);

    if (search === null) return;

    setResults(() => {
      const newResults = [];
      for (const folder of folders) {
        const result = search(folder);
        if (result && result.score <= 0) {
          newResults.push({
            item: folder,
            result
          });
        }
      }
      return newResults.sort((a, b) => a.result.score - b.result.score);
    });
  };

  return (
    <div>
      <input
        type="text"
        value={inputValue}
        onChange={search}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          search({
            target: { value: inputValue }
          } as ChangeEvent<HTMLInputElement>);
        }}
        ref={inputRef}
      />
      <div
        className="suggestion-container"
        tabIndex={0}
        style={{
          display: focused ? "block" : "none",
          overflow: "scroll"
        }}
        onBlur={() => setFocused(false)}
      >
        {results.map((result) => (
          <div
            className={styles["suggestion-item"]}
            onClick={() => {
              onSelect(result);
              setInputValue(result.item);
              search({
                target: { value: result.item }
              } as ChangeEvent<HTMLInputElement>);
              setFocused(false);
            }}
            key={result.item}
          >
            {result.item}
          </div>
        ))}
      </div>
    </div>
  );
};

interface SettingApiKeyProps {
  site: "Dev.to" | "Imgur";
}

const SettingApiKey = ({ site }: SettingApiKeyProps) => {
  const { plugin } = usePluginContext();
  const [isValid, setIsValid] = useState<boolean>(
    site === "Dev.to" ? (plugin.settings.validDevtoKey ?? false) : false
  );

  return (
    <SettingItem name="API Token" desc={`Your ${site} API token`} lastChild>
      <div className={styles["setting-api-key"]}>
        <button
          onClick={async () => {
            createReactModal(plugin, "TokenValidatorModal", site, () => {
              setIsValid(
                site === "Dev.to"
                  ? (plugin.settings.validDevtoKey ?? false)
                  : false
              );
            }).open();
          }}
        >
          Set Token
        </button>
        {site === "Dev.to" && (
          <div className={isValid ? styles["checkmark"] : styles["xmark"]}>
            {isValid ? <FaCheck /> : <FaXmark />}
          </div>
        )}
      </div>
    </SettingItem>
  );
};

type FileResult = {
  item: string;
  result: SearchResult;
};

const Settings = () => {
  const { plugin } = usePluginContext();

  return (
    <div className={styles["settings-container"]}>
      <SettingGroup title="Dev.to">
        <SettingApiKey site="Dev.to" />
      </SettingGroup>
      <SettingGroup title="Imgur">
        <SettingApiKey site="Imgur" />
      </SettingGroup>
      <SettingGroup title="General">
        <SettingItem
          name="Asset Directory"
          desc="The directory where the plugin will store images"
        >
          <SettingFileInput
            value={plugin.settings.assetDirectory}
            placeholder="Example: folder 1/folder 2"
            onSelect={(result) => {
              plugin.settings.assetDirectory = result.item;
              plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem
          name="Ignore Beginning Newlines"
          desc="Ignore the newlines between the title and the content"
        >
          <Toggle
            value={plugin.settings.ignoreBeginningNewlines}
            onChange={async (value) => {
              plugin.settings.ignoreBeginningNewlines = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
      </SettingGroup>
      <SettingGroup title="Image">
        <SettingItem
          name="Code Font Family"
          desc="The font family for the code snippets"
        >
          <Dropdown
            value={plugin.settings.codeFontFamily}
            options={{
              monospace: "Monospace",
              "Courier New": "Courier New",
              Consolas: "Consolas",
              "Lucida Console": "Lucida Console",
              "Source Code Pro": "Source Code Pro",
              "Fira Code": "Fira Code",
              "Roboto Mono": "Roboto Mono",
              Inconsolata: "Inconsolata"
            }}
            onChange={async (value) => {
              plugin.settings.codeFontFamily = value as CodeFontFamily;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem
          name="General Font Family"
          desc="The font family for the general text"
        >
          <Dropdown
            value={plugin.settings.generalFontFamily}
            options={{
              "sans-serif": "Sans Serif",
              Arial: "Arial",
              "Arial Black": "Arial Black",
              "Comic Sans MS": "Comic Sans MS",
              "Courier New": "Courier New",
              Georgia: "Georgia",
              Impact: "Impact",
              "Lucida Console": "Lucida Console",
              "Lucida Sans Unicode": "Lucida Sans Unicode",
              "Palatino Linotype": "Palatino Linotype",
              Tahoma: "Tahoma",
              "Times New Roman": "Times New Roman",
              "Trebuchet MS": "Trebuchet MS",
              Verdana: "Verdana"
            }}
            onChange={async (value) => {
              plugin.settings.generalFontFamily = value as GeneralFontFamily;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem
          name="Use Code Block Language for Caption"
          desc="Use the language of the code block as the caption for the image if caption is not provided"
        >
          <Toggle
            value={plugin.settings.useCodeBlockLanguageForCaption}
            onChange={async (value) => {
              plugin.settings.useCodeBlockLanguageForCaption = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem name="Custom Width" desc="Use custom width for the images">
          <Toggle
            value={plugin.settings.customWidth}
            onChange={async (value) => {
              plugin.settings.customWidth = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem name="Target Width" desc="The target width for the images">
          <SettingNumberInput
            value={plugin.settings.targetWidth.toString()}
            min={0}
            max={2560}
            onChange={async (value) => {
              plugin.settings.targetWidth = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem name="Image Scale" desc="The scale factor for the images">
          <SettingNumberInput
            value={plugin.settings.imageScale.toString()}
            min={1}
            max={8}
            onChange={async (value) => {
              plugin.settings.imageScale = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
        <SettingItem name="Smoothing" desc="Use image smoothing" lastChild>
          <Toggle
            value={plugin.settings.smoothing}
            onChange={async (value) => {
              plugin.settings.smoothing = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
      </SettingGroup>
      <SettingGroup title="Advanced">
        <SettingItem
          name="Load Time"
          desc="Time in milliseconds to wait before loading each code block"
          lastChild
        >
          <SettingNumberInput
            value={plugin.settings.loadTime.toString()}
            min={0}
            max={1000}
            onChange={async (value) => {
              plugin.settings.loadTime = value;
              await plugin.saveSettings();
            }}
          />
        </SettingItem>
      </SettingGroup>
    </div>
  );
};
