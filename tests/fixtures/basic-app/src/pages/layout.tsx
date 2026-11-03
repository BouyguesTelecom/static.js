import React from "react";

interface LayoutProps {
    children: React.ReactNode;
    pageData?: { layout?: { title?: string; description?: string } };
}

export const Layout = ({children, pageData}: LayoutProps) => {
    return (
        <html lang="fr">
        <head>
            <meta charSet="utf-8"/>
            <title>{pageData?.layout?.title || "Fixture default title"}</title>
            <meta name="description" content={pageData?.layout?.description || "default description"}/>
        </head>
        <body>
        <main data-layout="main">{children}</main>
        </body>
        </html>
    );
};
