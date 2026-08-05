import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";
import FAB from "@/components/FAB";

export default function MainLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="rov-public-shell flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />

      <main className="rov-public-main min-w-0 flex-1 pt-16 sm:pt-20">
        <Outlet />
      </main>

      <Footer />
      <FAB />
    </div>
  );
}