import React from "react";

export const Layout: React.FC<{ children: React.ReactNode }> = ({children}) => {
    return (
        <html lang="fr">
        <head>
            <title>Static JS</title>
        </head>
        <body>
        <div data-layout="main" className="container">
            {children}
        </div>
        </body>
        </html>
    );
};
