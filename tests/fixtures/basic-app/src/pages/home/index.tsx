import React, {useEffect, useState} from "react";
import {Head} from "@bouygues-telecom/staticjs/head";

export default function Home() {
    const [count, setCount] = useState(0);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <>
            <Head>
                <title>Home title from Head</title>
                <meta name="description" content="Home description from Head"/>
            </Head>
            <h1 data-testid="home-title">Home page</h1>
            <p data-testid="hydrated">{hydrated ? "hydrated" : "not-hydrated"}</p>
            <button data-testid="counter" onClick={() => setCount((c) => c + 1)}>
                Count: {count}
            </button>
        </>
    );
}
