import React, {useEffect} from "react";

const Index: () => React.JSX.Element = () => {
    useEffect(() => {
        console.log("Index page loaded!");
    }, []);

    return (
        <>
            <h1 className="title">🚀 StaticJS</h1>
            <button className="button is-primary" onClick={() => console.log("Home page button clicked!")}>
                Click me!
            </button>
        </>
    );
};

export default Index;
