import { Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import type MdBlogger from "../../main";
import type { ReactNode } from "react";
import { PluginProvider } from "../context";
import { TokenValidatorModal } from "./tokenValidator/tokenValidator";
import { PublishModal } from "./publish/publish";

type ModalType = "TokenValidatorModal" | "PublishModal";

class ReactModal extends Modal {
  private root: Root | undefined;
  private plugin: MdBlogger;
  private modalType: ModalType;
  private site?: "Dev.to" | "Imgur";
  constructor(
    plugin: MdBlogger,
    type: ModalType,
    site?: "Dev.to" | "Imgur",
    onClose?: () => void
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.modalType = type;
    this.site = site;
    if (onClose) this.onClose = onClose;
    this.root = createRoot(this.contentEl);
  }

  onOpen() {
    this.root!.render(
      <PluginProvider plugin={this.plugin}>
        {this.getModalContent()}
      </PluginProvider>
    );
  }

  onClose() {
    this.root?.unmount();
  }

  getModalContent(): ReactNode {
    switch (this.modalType) {
      case "TokenValidatorModal":
        return <TokenValidatorModal modal={this} site={this.site!} />;
      case "PublishModal":
        return <PublishModal />;
    }
  }
}

export const createReactModal = (
  plugin: MdBlogger,
  modalType: ModalType,
  site?: "Dev.to" | "Imgur",
  onClose?: () => void
) => {
  return new ReactModal(plugin, modalType, site, onClose);
};
