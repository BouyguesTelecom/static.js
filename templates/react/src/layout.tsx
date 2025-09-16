import React from "react";

interface LayoutProps {
    children: React.ReactNode;
    pageData?: {
        layout?: {
            title?: string;
            meta?: {
                description?: string;
            };
        };
    };
}

export const Layout = ({children, pageData}: LayoutProps) => {
    return (
        <html lang="fr">
        <head>
            <title>{pageData?.layout?.title || "Static JS"}</title>
            <meta name="description" content={pageData?.layout?.meta?.description || ""}/>
        </head>
        <body>
        <div data-layout="main" className="container">
            {children}
        </div>
        </body>
        </html>
    );
};
