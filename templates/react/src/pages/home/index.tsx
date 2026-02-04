import React, {useEffect} from "react";

const Index: () => React.JSX.Element = () => {
    useEffect(() => {
        console.log("Index page loaded!");
    }, []);

    return (
        <>
            <h1 className="title">🚀 StaticJS</h1>
            <button onClick={() => console.log("Home page button clicked!")}>
                Click me!
            </button>
            <p>
                <a href="/partials/page1">Go to /partials/page1</a>
            </p>
        </>
    );
};

export default Index;
