import React, {useEffect, useState} from "react";

export const getStaticProps = async () => {
    return {props: {data: {label: process.env.FIXTURE_LABEL || "greeting"}}};
};

export default function Greeting({data}: { data: { label: string } }) {
    const [open, setOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <section data-testid="greeting-fragment" data-label={data?.label} data-hydrated={hydrated ? "true" : "false"}>
            <button data-testid="greeting-toggle" onClick={() => setOpen((o) => !o)}>
                {data?.label}: {open ? "open" : "closed"}
            </button>
        </section>
    );
}
