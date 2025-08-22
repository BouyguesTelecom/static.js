import React from "react";

export const getStaticPaths = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos");
    const todos = await res.json();

    const paths = todos
        .map((todo: { id: number }) => ({params: {id: todo.id.toString()}}))
        .slice(0, 10);

    return {paths, fallback: false};
};

interface ParamsProps {
    params: {
        id: string;
    };
}

export const getStaticProps = async ({params}: ParamsProps) => {
    const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${params?.id}`);
    const todo = await res.json();
    return {props: {data: todo}};
};

interface DataProps {
    data: {
        id: number;
        title: string;
    };
}

const TodoPage: ({data}: DataProps) => React.JSX.Element = ({data}: DataProps) => {
    return (
        <>
            <p className="title">Page ID: {data?.id}</p>
            <p className="text">{data?.title}</p>
            <button className="button is-primary" onClick={() => console.log(data)}>
                Click me!
            </button>
        </>
    );
};

export default TodoPage;
