import React, { createContext, useState } from 'react';

export const LoadingContext = createContext({
    isInitialLoading: true, 
    setLoadingState: () => {}, 
});

export const LoadingProvider = ({ children }) => {
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const contextValue = {
        isInitialLoading,
        setLoadingState: setIsInitialLoading,
    };

    return (
        <LoadingContext.Provider value={contextValue}>
            {children}
        </LoadingContext.Provider>
    );
};
