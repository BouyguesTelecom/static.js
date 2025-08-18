import React, { useEffect } from "react";

const Index: () => React.JSX.Element = () => {
  useEffect(() => {
    console.log("Index page loaded!");
  }, []);

  return (
    <div>
      <h1 className="title">🚀 StaticJS</h1>
      <div>
        <h2>Available Pages:</h2>
        <ul>
          <li><a href="/page1">Page 1 (with getStaticProps)</a></li>
          <li><a href="/page2">Page 2 (static)</a></li>
          <li><a href="/page3/1">Page 3 - Todo 1 (dynamic route)</a></li>
          <li><a href="/page3/2">Page 3 - Todo 2 (dynamic route)</a></li>
        </ul>
      </div>
      <button
        className="button is-primary"
        onClick={() => console.log("Home page button clicked!")}
      >
        Click me!
      </button>
    </div>
  );
};

export default Index;
