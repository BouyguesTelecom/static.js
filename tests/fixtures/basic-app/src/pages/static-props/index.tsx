import React from "react";
import {Head} from "@bouygues-telecom/staticjs/head";

export const getStaticProps = async () => {
    return {
        props: {
            data: {
                message: "Hello from getStaticProps",
                unsafe: "</script><script>window.__xss = true</script>",
            },
        },
    };
};

interface Props {
    data: { message: string; unsafe: string };
}

export default function StaticProps({data}: Props) {
    return (
        <>
            <Head>
                <title>Static props title</title>
            </Head>
            <p data-testid="message">{data.message}</p>
            <p data-testid="unsafe">{data.unsafe}</p>
        </>
    );
}
