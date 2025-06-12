import { Layout } from "@/layout";
import React from "react";

export const App: React.FC<{ Component: any; props: any }> = ({
  Component,
  props,
}) => {
  return (
    <Layout>
      <Component {...props} />
    </Layout>
  );
};
