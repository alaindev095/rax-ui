// Umunara — Global configuration
export const CONFIG = {
  appName: "Umunara",
  version: "1.0.0",
  // Node.js backend (see /backend). Override at runtime via
  // localStorage.setItem('umunara_api_base', 'https://your-api.example.com/api')
  apiBaseUrl: (typeof localStorage !== "undefined" && localStorage.getItem("umunara_api_base")) || "http://localhost:5000/api",
  // This build talks to the real Umunara backend — mock data is no longer used.
  mockMode: false,
  defaultRole: "student",
  roles: {
    student: { label: "Student", home: "/students/home" },
    teacher: { label: "Teacher", home: "/teachers/home" },
    admin: { label: "School Admin", home: "/admin/home" },
    company: { label: "Company", home: "/companies/home" },
    super_admin: { label: "Super Admin", home: "/super-admin/home" },
  },
};

// Injected into window for legacy scripts
if (typeof window !== "undefined") {
  window.UMUNARA_CONFIG = CONFIG;
}
