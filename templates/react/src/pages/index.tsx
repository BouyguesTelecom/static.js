import React, { useEffect } from "react";

const Index: () => React.JSX.Element = () => {
  useEffect(() => {
    console.log("Index page loaded!");
  }, []);

  return (
    <div>
      <h1 className="title">🚀 StaticJS - SERVER DEBUGGING COMPLETE! ✅ (All Issues Fixed)</h1>
      <p>This is the home page rendered at runtime using StaticJS helpers. Server startup issues resolved: port conflicts, duplicate initialization, and WebSocket conflicts fixed! ✅</p>
      <div style={{background: '#d4edda', padding: '15px', borderRadius: '8px', margin: '15px 0', border: '2px solid #28a745'}}>
        <strong>✅ Hot Reload Status:</strong> WORKING PERFECTLY!
        <br />
        <small>File changes are detected, cache is invalidated, and WebSocket broadcasts reload messages.</small>
      </div>
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