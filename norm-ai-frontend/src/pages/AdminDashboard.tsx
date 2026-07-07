import { Routes, Route } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import AdminDashboardHome from "./AdminDashboardHome";
import AdminStudents from "./AdminStudents";
import AdminTeachers from "./AdminTeachers";
import TeacherHolidays from "./TeacherHolidays";
import AdminSettings from "./AdminSettings";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminDashboardHome />} />
        <Route path="/students" element={<AdminStudents />} />
        <Route path="/teachers" element={<AdminTeachers />} />
        <Route path="/holidays" element={<TeacherHolidays />} />
        <Route path="/settings" element={<AdminSettings />} />
      </Routes>
    </AdminLayout>
  );
}
