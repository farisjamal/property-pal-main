import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPropertyOwners from "./pages/admin/AdminPropertyOwners";
import AdminReports from "./pages/admin/AdminReports";
import OwnerLayout from "./components/layout/OwnerLayout";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import OwnerProperties from "./pages/owner/OwnerProperties";
import OwnerAppointments from "./pages/owner/OwnerAppointments";
import OwnerProfile from "./pages/owner/OwnerProfile";
import TenantLayout from "./components/layout/TenantLayout";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import TenantProperties from "./pages/tenant/TenantProperties";
import TenantAppointments from "./pages/tenant/TenantAppointments";
import TenantProfile from "./pages/tenant/TenantProfile";

const queryClient = new QueryClient();

import PropertyChatbot from "./components/chat/PropertyChatbot";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={[1]}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="owners" element={<AdminPropertyOwners />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          {/* Owner Routes */}
          <Route path="/owner" element={<ProtectedRoute allowedRoles={[2]}><OwnerLayout /></ProtectedRoute>}>
            <Route index element={<OwnerDashboard />} />
            <Route path="properties" element={<OwnerProperties />} />
            <Route path="appointments" element={<OwnerAppointments />} />
            <Route path="profile" element={<OwnerProfile />} />
          </Route>

          {/* Tenant Routes */}
          <Route path="/tenant" element={<ProtectedRoute allowedRoles={[3]}><TenantLayout /></ProtectedRoute>}>
            <Route index element={<TenantDashboard />} />
            <Route path="properties" element={<TenantProperties />} />
            <Route path="appointments" element={<TenantAppointments />} />
            <Route path="profile" element={<TenantProfile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <PropertyChatbot />
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
