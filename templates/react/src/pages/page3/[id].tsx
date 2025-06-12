import React from "react";

export const getStaticPaths = async () => {
  const res = await fetch("https://jsonplaceholder.typicode.com/todos");
  const todos = await res.json();

  const paths = todos
    .map((todo: any) => ({
      params: { id: todo.id.toString() },
    }))
    .slice(0, 10);

  return { paths, fallback: false };
};

export const getStaticProps = async ({ params }: any) => {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos/${params?.id}`
  );
  const todo = await res.json();
  return { props: { data: todo } };
};

const TodoPage: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div>
      <p className="title">Todo ID: {data?.id}</p>
      <p className="text">{data?.title}</p>
      <button className="button is-primary" onClick={() => console.log(data)}>
        Click me!
      </button>
    </div>
  );
};

export default TodoPage;
