import React from "react";
import {Head} from "@bouygues-telecom/staticjs/head";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getServerSideProps = async ({req}: { req?: any }) => {
    return {
        props: {
            data: {
                renderedAt: `${Date.now()}-${Math.random()}`,
                header: req?.headers?.["x-fixture"] ?? "none",
                title: typeof req?.query?.t === "string" ? req.query.t : "Preview",
            },
        },
    };
};

interface Props {
    data: { renderedAt: string; header: string; title: string };
}

export default function Preview({data}: Props) {
    return (
        <>
            <Head>
                <title>{data?.title}</title>
            </Head>
            <p data-testid="rendered-at">{data?.renderedAt}</p>
            <p data-testid="header">{data?.header}</p>
        </>
    );
}
