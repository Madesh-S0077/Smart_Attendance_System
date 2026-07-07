import { Routes, Route } from "react-router-dom";
import TeacherLayout from "../components/layout/TeacherLayout";
import TeacherDashboardHome from "./TeacherDashboardHome";
import TeacherHolidays from "./TeacherHolidays";

export default function TeacherDashboard() {
  return (
    <TeacherLayout>
      <Routes>
        <Route path="/" element={<TeacherDashboardHome />} />
        <Route path="/holidays" element={<TeacherHolidays />} />
      </Routes>
    </TeacherLayout>
  );
}
