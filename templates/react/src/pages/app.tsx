import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const App: React.FC<{ Component: React.FC; props: any; pageData?: any }> = ({Component, props, pageData}) => {
    return (
        <Component {...props} pageData={pageData} />
    );
};
