import React, { createContext, useContext, useState } from 'react';

const CredentialContext = createContext();

export const CredentialProvider = ({ children }) => {
  const [credentials, setCredentials] = useState({
    certFile: null,
    keyFile: null,
    userId: '',
    password: '',
    apiKey: '',
    sharedSecret: '',
  });

  return (
    <CredentialContext.Provider value={{ credentials, setCredentials }}>
      {children}
    </CredentialContext.Provider>
  );
};

export const useCredentials = () => useContext(CredentialContext); 