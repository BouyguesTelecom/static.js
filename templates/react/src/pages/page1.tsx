import React, {useEffect} from "react";

export const getStaticProps = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const todo = await res.json();
    return {
        props: {
            data: todo,
        },
    };
};

interface DataProps {
    data: {
        id: number;
        title: string;
    };
}

const Page1: React.FC<DataProps> = ({data}) => {
    useEffect(() => {
        console.log("Page1 loaded!");
    }, []);

    return (
        <>
            <p className="title">Page ID: {data?.id}</p>
            <p>I'm a ninja!</p>
            <button className="button is-primary" onClick={() => console.log(data)}>
                Click me!
            </button>
        </>
    );
};

export default Page1;
