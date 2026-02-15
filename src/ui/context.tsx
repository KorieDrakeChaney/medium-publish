import { createContext, useContext, ReactNode } from "react";
import MdBlogger from "src/main";

interface PluginState {
  plugin: MdBlogger;
}

const PluginContext = createContext<PluginState | undefined>(undefined);

interface PluginProviderProps {
  children: ReactNode;
  plugin: MdBlogger;
}

export const PluginProvider = ({ children, plugin }: PluginProviderProps) => {
  return (
    <PluginContext.Provider value={{ plugin }}>
      {children}
    </PluginContext.Provider>
  );
};

export const usePluginContext = () => {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error("usePluginContext must be used within an PluginProvider");
  }
  return context;
};
