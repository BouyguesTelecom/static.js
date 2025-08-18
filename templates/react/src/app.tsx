import {Layout} from "@/layout";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const App: React.FC<{ Component: React.FC; props: any }> = ({Component, props}) => {
    return (
        <Layout>
            <Component {...props} />
        </Layout>
    );
};
