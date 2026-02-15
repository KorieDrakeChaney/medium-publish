import styles from "./publish.module.css";
import { usePluginContext } from "../../context";
import { useEffect, useState } from "react";
import { MarkdownView, Notice } from "obsidian";
import {
  Button,
  DropDown,
  ContentViewer,
  SettingItem,
  Toggle,
  VisualDropdown
} from "src/ui/components";
import type { PublishBody } from "src/api/response";
import Tag from "./tag";
import { PublishConfig } from "src/api/types";
import { DevtoIcon } from "src/icons";
import { FaCheck, FaXmark } from "react-icons/fa6";
import { PublishRequest } from "src/api/request";
import SettingNumberInput from "src/ui/components/number-input/number-input";

type PublishStatus = "public" | "draft" | "unlisted";

interface SelectProps {
  onToggle: (isSelected: boolean) => void;
  disabled?: boolean;
}

const Select = ({ onToggle, disabled }: SelectProps) => {
  const [isSelected, setIsSelected] = useState(false);
  return (
    <div
      className={`${styles["select-item-container"]} ${
        isSelected ? styles["active"] : ""
      } ${disabled ? styles["disabled"] : ""}`}
      onClick={() => {
        if (disabled) return;
        setIsSelected(!isSelected);
        onToggle(!isSelected);
      }}
    >
      <DevtoIcon />
      <div
        className={`${styles["select"]} ${isSelected ? styles["active"] : ""} `}
      >
        {isSelected ? <FaCheck /> : <FaXmark />}
      </div>
      <div className={styles["select-site"]}>Dev.to</div>
    </div>
  );
};

export const PublishModal = () => {
  const { plugin } = usePluginContext();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<PublishStatus>("public");
  const [tags, setTags] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [currentFile, setCurrentFile] = useState<null | string>(null);
  const [canonicalURL, setCanonicalURL] = useState("");
  const [series, setSeries] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [init, setInit] = useState(false);
  const [data, setData] = useState<PublishBody | null>(null);

  const [publishConfig, setPublishConfig] = useState<PublishConfig>({
    devto: false
  });

  useEffect(() => {
    const load = async () => {
      const currentView =
        plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (currentView) {
        setTitle(currentView.file.basename);
        setCurrentFile(currentView.file.path);
      } else {
        new Notice("No markdown file is being viewed");
      }
    };
    load();
  }, []);

  const onPublish = async () => {
    setError("");

    const body: PublishRequest = {
      title,
      description,
      series,
      canonicalURL,
      config: publishConfig,
      tags: Object.values(tags),
      publishStatus: status
    };

    setLoading(true);

    if (publishConfig.devto) {
      if (!title && publishConfig.devto) {
        new Notice("Title is required for Dev.to");
        setError("Title is required for Dev.to");
        setErrorCount(errorCount + 1);
        setLoading(false);
        return;
      }
      await plugin.services.api.publish(body, currentFile).then((response) => {
        if (response) {
          setData(response.data);
          new Notice("Published successfully");
        } else {
          new Notice("Error while publishing");
          setError("Error while publishing");
        }
        setLoading(false);
      });
    } else {
      const { html, rawMarkdown } = await plugin.services.api.getContent(
        currentFile,
        title,
        publishConfig
      );

      setData({
        html,
        markdown: rawMarkdown
      });
    }
  };

  if (!init) {
    return (
      <div className={styles["publish-select-container"]}>
        <div>
          <h2>Publish to</h2>
        </div>
        <div className={styles["select-container"]}>
          <Select
            onToggle={(isSelected) =>
              setPublishConfig({ ...publishConfig, devto: isSelected })
            }
            disabled={loading || !plugin.settings.validDevtoKey}
          />
        </div>

        <div className={styles["publish-end-container"]}>
          <div className={styles["loading"]}>
            {loading && "Validating tokens..."}
          </div>
          <div className={styles["select-button"]}>
            <Button
              style="primary"
              name="Continue"
              onClick={() => {
                setInit(true);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {data ? (
        <div className={styles["publish-container"]}>
          <div className={styles["publish-success"]}>
            <h2>Links</h2>
            <div className={styles["publish-links"]}>
              {data.devto && (
                <a href={data.devto.url} target="_blank" rel="noreferrer">
                  Dev.to
                </a>
              )}
            </div>
          </div>

          <h2>Content</h2>
          <ContentViewer markdown={data.markdown} html={data.html} />
        </div>
      ) : (
        <div className={styles["publish-container"]}>
          <div>
            <h2>Publish</h2>
          </div>
          <div className={styles["publish-settings"]}>
            <VisualDropdown title="Config">
              <SettingItem
                name="Use Dark Theme"
                desc="Use dark theme for the generated images"
              >
                <Toggle
                  value={plugin.settings.useDarkTheme}
                  onChange={async (value) => {
                    plugin.settings.useDarkTheme = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
              <SettingItem
                name="Code Snippets as PNG"
                desc="Convert code snippets to PNG images instead of using code blocks"
              >
                <Toggle
                  value={plugin.settings.convertCodeToPng}
                  onChange={async (value) => {
                    plugin.settings.convertCodeToPng = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
              <SettingItem
                name="Use Filename as Title"
                desc="Use the filename as the title if the title is not provided"
              >
                <Toggle
                  value={plugin.settings.useFilenameAsTitle}
                  onChange={async (value) => {
                    plugin.settings.useFilenameAsTitle = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
              <SettingItem
                name="Table as Image Markdown"
                desc="Convert tables to images for markdown content"
              >
                <Toggle
                  value={plugin.settings.convertTableToPng}
                  onChange={async (value) => {
                    plugin.settings.convertTableToPng = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
              <SettingItem
                name="Create TOC"
                desc="Create a Table of Contents"
                lastChild
              >
                <Toggle
                  value={plugin.settings.createTOC}
                  onChange={async (value) => {
                    plugin.settings.createTOC = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
              <SettingItem
                name="Use Numbered TOC"
                desc="Use numbered headings in the Table of Contents"
              >
                <Toggle
                  value={plugin.settings.useNumberedTOC}
                  onChange={async (value) => {
                    plugin.settings.useNumberedTOC = value;
                    await plugin.saveSettings();
                  }}
                />
              </SettingItem>
            </VisualDropdown>
            <VisualDropdown title="General" open>
              <div className={styles["publish-input"]}>
                <label className={styles["publish-label"]}>Title</label>
                <input
                  type="text"
                  value={title}
                  placeholder="My first blog!"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              {publishConfig.devto && (
                <div className={styles["publish-input"]}>
                  <label className={styles["publish-label"]}>Tags</label>
                  <input
                    placeholder={
                      Object.keys(tags).length >= 5 ? "Max 5 tags" : "Add tags"
                    }
                    disabled={Object.keys(tags).length >= 5}
                    maxLength={25}
                    type="text"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        e.currentTarget.value.length > 0
                      ) {
                        const newTags = { ...tags };
                        let value = e.currentTarget.value;
                        if (newTags[value]) {
                          new Notice("Tag already exists");
                        } else {
                          newTags[value] = e.currentTarget.value;
                          setTags(newTags);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              )}
              {publishConfig.devto && (
                <div
                  className={styles["tags-container"]}
                  style={{
                    display: Object.keys(tags).length > 0 ? "flex" : "none"
                  }}
                >
                  {Object.entries(tags).map(([key, value]) => (
                    <Tag
                      key={key}
                      tag={value}
                      onDelete={() => {
                        const newTags = { ...tags };
                        delete newTags[key];
                        setTags(newTags);
                      }}
                    />
                  ))}
                </div>
              )}
              {publishConfig.devto && (
                <div className={styles["publish-input"]}>
                  <label className={styles["publish-label"]}>
                    Canonical URL
                  </label>
                  <input
                    type="text"
                    value={canonicalURL}
                    onChange={(e) => setCanonicalURL(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>
              )}
            </VisualDropdown>
            {publishConfig.devto && (
              <VisualDropdown title="Dev.to" open>
                <label className={styles["publish-label"]}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description of the article"
                  style={{
                    resize: "none"
                  }}
                />
                <label className={styles["publish-label"]}>Series</label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="Series name"
                />
              </VisualDropdown>
            )}
          </div>
          {publishConfig.devto && (
            <div>
              <label className={styles["publish-label"]}>Publish Status</label>
              <div
                className={styles["publish-status-container"]}
                style={{
                  gridTemplateColumns: "repeat(2, 1fr)"
                }}
              >
                {(["public", "unlisted"] as PublishStatus[]).map((s) => (
                  <div
                    key={s}
                    className={`${styles["publish-status-button"]} ${
                      s === status ? styles["active"] : ""
                    }`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles["publish-end-container"]}>
            <div>
              {error && (
                <div className={styles["error"]} key={errorCount}>
                  {error}
                </div>
              )}
              <div className={styles["loading"]}>
                {loading && "Publishing..."}
              </div>
            </div>
            <Button
              style="primary"
              name={!publishConfig.devto ? "Generate" : "Publish"}
              onClick={onPublish}
            />
          </div>
        </div>
      )}
    </>
  );
};
