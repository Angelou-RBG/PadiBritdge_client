import React from 'react';
import { useParams } from 'react-router-dom';

export default function Edit() {
  const { id } = useParams();

  return (
    <section className="page-shell card-shell">
      <h2>Edit</h2>
      <p>Editing record id: {id}</p>
    </section>
  );
}
