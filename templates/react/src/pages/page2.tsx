import React, { useEffect } from "react";

const Page2: () => React.JSX.Element = () => {
  useEffect(() => {
    console.log("Page2 loaded !");
  }, []);

  return (
    <div>
      <p className="title">Page 2</p>
      <button
        className="button is-primary"
        onClick={() => console.log("page 2")}
      >
        Click me!
      </button>
    </div>
  );
};

export default Page2;
