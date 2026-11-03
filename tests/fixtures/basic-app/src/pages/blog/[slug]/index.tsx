import React from "react";

export const getStaticPaths = async () => {
    return {
        paths: [{params: {slug: "first-post"}}, {params: {slug: "second-post"}}],
        fallback: false,
    };
};

export const getStaticProps = async ({params}: { params: { slug: string } }) => {
    return {props: {data: {slug: params.slug}}};
};

export default function BlogPost({data}: { data: { slug: string } }) {
    return <h1 data-testid="slug">Post: {data?.slug}</h1>;
}
