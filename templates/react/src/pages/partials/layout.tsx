import React from "react";

export const Layout: React.FC<{ children: React.ReactNode }> = ({children}) => {
    return (
        <div data-layout="partials">
            <link
                rel="stylesheet"
                href="https://assets.bouyguestelecom.fr/TRILOGY/trilogy-styles@4/default/trilogy.css"
            />
            {children}
        </div>
    );
};
