import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ShoppingCart, ClipboardList, Lock, BarChart3, Settings } from "lucide-react";
import { useCartStore } from "../store/cartStore";
import Toaster from "./ui/Toaster";
import ConfirmDialogRoot from "./ui/ConfirmDialog";
import { usePedidos } from "../api/pedidos";

export default function Layout() {
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((acc, item) => acc + item.cantidad, 0);
  const location = useLocation();

  // Badge: cuántos pedidos pendientes hay (vista del encargado).
  const { data: pendientes = [] } = usePedidos({ estado: "pendiente" });

  const navItems = [
    { to: "/", icon: ShoppingCart, label: "Kiosko", badge: totalItems },
    { to: "/pedidos", icon: ClipboardList, label: "Pedidos", badge: pendientes.length },
    { to: "/castigos", icon: Lock, label: "Castigos" },
    { to: "/estadisticas", icon: BarChart3, label: "Stats" },
    { to: "/ajustes", icon: Settings, label: "Ajustes" },
  ];

  const tituloPagina = (() => {
    switch (location.pathname) {
      case "/":
        return "Kiosko";
      case "/pedidos":
        return "Pedidos";
      case "/castigos":
        return "Castigos";
      case "/estadisticas":
        return "Estadísticas";
      case "/ajustes":
        return "Ajustes";
      default:
        return "Kiosko GJ";
    }
  })();

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex flex-col pt-safe">
      <header className="fixed top-0 left-0 right-0 h-11 bg-white/75 backdrop-blur-xl border-b border-[#c6c6c8] z-30 pt-safe flex items-center justify-center">
        <h1 className="text-[17px] font-semibold text-black tracking-tight">{tituloPagina}</h1>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto pt-14 pb-24 px-2 overflow-y-auto hidden-scrollbar">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-[#c6c6c8] pb-safe z-30">
        <div className="flex justify-around items-center h-[56px] max-w-2xl mx-auto px-2 pt-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-[2px] relative ${
                  isActive ? "text-[#007AFF]" : "text-[#8E8E93] hover:text-[#007AFF]/80"
                }`
              }
            >
              <div className="relative">
                <item.icon className="w-[24px] h-[24px]" strokeWidth={1.7} />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-[#FF3B30] text-white text-[10px] font-bold px-[5px] py-[1px] min-w-[18px] text-center rounded-full border border-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster />
      <ConfirmDialogRoot />
    </div>
  );
}
