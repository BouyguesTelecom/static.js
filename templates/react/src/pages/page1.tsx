import React, { useEffect } from "react";

export const getStaticProps = async () => {
  const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
  const todo = await res.json();
  return {
    props: {
      data: todo,
    },
  };
};

const Page1: React.FC<{ data: any }> = ({ data }) => {
  useEffect(() => {
    console.log("Page1 loaded !");
  }, []);

  return (
    <div>
      <p className="title">Todooo ID: {data?.id}</p>
      <button className="button is-primary" onClick={() => console.log(data)}>
        Click me!
      </button>
    </div>
  );
};

export default Page1;
