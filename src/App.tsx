import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Wizard from './components/Wizard';
import Tracking from './components/Tracking';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Wizard />} />
        <Route path="/tracking/:folio" element={<Tracking />} />
      </Routes>
    </BrowserRouter>
  );
}
