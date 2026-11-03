import React from "react";

export const Layout = ({children}: { children: React.ReactNode }) => {
    return <div data-layout="partials">{children}</div>;
};
