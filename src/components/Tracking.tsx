import { useParams } from 'react-router-dom';

export default function Tracking() {
  const { folio } = useParams();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Seguimiento de Denuncia</h1>
      <p>Folio: {folio}</p>

    </div>
  );
}
