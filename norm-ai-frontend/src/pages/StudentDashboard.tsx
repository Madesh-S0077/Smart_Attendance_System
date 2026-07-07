import { Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout";
import StudentDashboardHome from "./StudentDashboardHome";
import StudentHistory from "./StudentHistory";

export default function StudentDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<StudentDashboardHome />} />
        <Route path="/history" element={<StudentHistory />} />
      </Routes>
    </Layout>
  );
}
