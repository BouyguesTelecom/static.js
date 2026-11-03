import React, {useEffect, useState} from "react";

export const getStaticProps = async () => {
    return {props: {data: {label: process.env.FIXTURE_LABEL || "counter"}}};
};

export default function Counter({data}: { data: { label: string } }) {
    const [count, setCount] = useState(0);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <section data-testid="fragment" data-label={data?.label} data-hydrated={hydrated ? "true" : "false"}>
            <span data-testid="fragment-label">{data?.label}</span>
            <button data-testid="fragment-counter" onClick={() => setCount((c) => c + 1)}>
                {data?.label}: {count}
            </button>
        </section>
    );
}
