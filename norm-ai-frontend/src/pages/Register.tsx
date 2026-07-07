import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#F7F8FC] flex flex-col justify-center items-center p-6 relative">
      {/* Back button */}
      <button
        onClick={() => navigate("/login")}
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#1E293B] transition-all"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Sign In
      </button>

      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-[#1E293B] mb-2">Create an Account</h1>
        <p className="text-[#64748B] text-sm">Select your role to start registering for Norm AI</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-[720px]">
        {/* Student Card */}
        <div
          onClick={() => navigate("/register/student")}
          className="flex-1 bg-white p-8 rounded-3xl border-2 border-transparent hover:border-[#5B5FEF] hover:scale-[1.03] shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 bg-[#5B5FEF]/10 rounded-2xl flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-[#5B5FEF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1E293B] mb-2">I'm a Student</h2>
          <p className="text-[#64748B] text-sm">Register your face to mark attendance automatically</p>
        </div>

        {/* Teacher Card */}
        <div
          onClick={() => navigate("/register/teacher")}
          className="flex-1 bg-white p-8 rounded-3xl border-2 border-transparent hover:border-[#5B5FEF] hover:scale-[1.03] shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 bg-[#5B5FEF]/10 rounded-2xl flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-[#5B5FEF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1E293B] mb-2">I'm a Teacher</h2>
          <p className="text-[#64748B] text-sm">Manage class slots, verify logs, and oversee students</p>
        </div>
      </div>
    </div>
  );
}
