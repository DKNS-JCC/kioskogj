import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import Kiosko from "./pages/Kiosko";
import Ajustes from "./pages/Ajustes";
import Castigos from "./pages/Castigos";
import Estadisticas from "./pages/Estadisticas";
import Pedidos from "./pages/Pedidos";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Kiosko /> },
      { path: "pedidos", element: <Pedidos /> },
      { path: "castigos", element: <Castigos /> },
      { path: "estadisticas", element: <Estadisticas /> },
      { path: "ajustes", element: <Ajustes /> },
      // Rutas antiguas (Niños/Productos) ahora viven dentro de Ajustes.
      { path: "ninos", element: <Navigate to="/ajustes" replace /> },
      { path: "productos", element: <Navigate to="/ajustes" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
