import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CustomAlertModal, AlertConfig } from '../components/CustomAlertModal';

interface AlertContextValue {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

// Standalone global trigger for utility files outside React components
let globalAlertHandler: ((config: AlertConfig) => void) | null = null;

export const showAppAlert = (config: AlertConfig) => {
  if (globalAlertHandler) {
    globalAlertHandler(config);
  } else {
    console.warn('AlertProvider is not yet mounted to show alert:', config);
  }
};

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = (config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  // Register global handler
  globalAlertHandler = showAlert;

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <CustomAlertModal
        visible={visible}
        config={alertConfig}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextValue => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
