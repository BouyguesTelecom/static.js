import { Layout } from "@/layout";
import React from "react";

export const App: React.FC<{ Component: React.FC; props: {} }> = ({
  Component,
  props,
}) => {
  return (
    <Layout>
      <Component {...props} />
    </Layout>
  );
};
