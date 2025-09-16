import React, {useEffect} from "react";
import page from "./data.json";

export const getStaticProps = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const todo = await res.json();
    return {
        props: {
            data: todo,
        }
    };
};

interface DataProps {
    data: {
        id: number;
        title: string;
        userId: number;
        completed: boolean;
    };
}

const Page1: React.FC<DataProps> = ({data}) => {
    useEffect(() => {
        console.log("Page1 loaded!");
    }, []);

    return (
        <>
            <h1>{page.title}</h1>
            <p className="title">Page ID: {data?.id}</p>
            <p>{page.description}</p>
            <button className="button is-primary" onClick={() => console.log(data)}>
                Click me!
            </button>
        </>
    );
};

export default Page1;
