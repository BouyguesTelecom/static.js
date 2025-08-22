import React from "react";

export const Layout: React.FC<{ children: React.ReactNode }> = ({children}) => {
    return (
        <div data-layout="partials">
            {children}
        </div>
    );
};
