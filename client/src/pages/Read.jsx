import React from 'react';
import { useParams } from 'react-router-dom';

export default function Read() {
  const { id } = useParams();

  return (
    <section className="page-shell card-shell">
      <h2>Read</h2>
      <p>Viewing record id: {id}</p>
    </section>
  );
}
